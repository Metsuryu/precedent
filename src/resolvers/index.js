/**
 * UI Kit resolvers for the Confluence macro and the Jira issue panel.
 * The frontend calls these via `invoke(name, payload)`.
 */
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { upsertFromSource, listDecisions } from '../store/decisions.js';
import { checkIssueCached, whoToAsk, present, recordDecision, supersedeDecision } from '../services/precedent.js';
import { formToInput } from '../lib/record-input.js';
import { filterLog, allTags, logCounts } from '../lib/log-filter.js';
import { claimPageAsUser } from '../services/confluence.js';
import { DEMO_DECISIONS } from '../seed/demo-data.js';

const resolver = new Resolver();

/**
 * Called by the "Decision record" macro when it renders.
 * Saves/updates the decision captured in the macro config (idempotent per macro instance).
 */
resolver.define('syncDecisionMacro', async ({ payload, context }) => {
  const config = context.extension?.config || payload?.config || {};
  const pageId = context.extension?.content?.id;
  const localId = context.localId || payload?.localId;
  if (!config.title || !pageId || !localId) return { saved: false, reason: 'not-configured' };
  // Don't persist while the page is still a draft being edited.
  if (context.extension?.isEditing) return { saved: false, reason: 'editing' };
  const siteUrl = context.siteUrl || '';
  const rec = await upsertFromSource(
    {
      sourceKey: `${pageId}:${localId}`,
      sourceType: 'confluence',
      sourceUrl: siteUrl ? `${siteUrl}/wiki/pages/viewpage.action?pageId=${pageId}` : '',
      sourceTitle: context.extension?.content?.title || payload?.pageTitle || '',
      recordedBy: context.accountId,
    },
    config
  );
  return { saved: true, ref: rec.ref, status: rec.status };
});

/** Called by the Jira issue panel: related decisions + possible contradictions. */
// Serves the precomputed result when current (see triggers/jira.js); `fresh` forces a live check.
resolver.define('checkCurrentIssue', async ({ payload, context }) => {
  const id = context.extension?.issue?.id || context.extension?.issue?.key;
  if (!id) return { error: 'No issue in context' };
  return checkIssueCached(id, { limit: 6, fresh: Boolean(payload?.fresh) });
});

/** Teamwork Graph "who decided / who to ask" for a few decisions shown in the panel. */
resolver.define('whoToAsk', async ({ payload, context }) => {
  const ids = (payload?.ids || []).slice(0, 3);
  const opts = { cloudId: context.cloudId, accountId: context.accountId, projectId: payload?.projectId };
  const results = await Promise.all(ids.map((id) => whoToAsk(id, opts).catch((e) => ({ id, errors: [String(e.message || e)] }))));
  return Object.fromEntries(results.map((r, i) => [ids[i], r]));
});

/**
 * Whether the demo Claim control should show (seed:page exists in KVS).
 * Returns page id/url/title for the button label; claimed=true if already claimed once.
 */
resolver.define('getDemoClaim', async () => {
  const seed = await kvs.get('seed:page');
  if (!seed?.id) return { available: false };
  const claimed = await kvs.get('seed:claimed');
  return {
    available: true,
    pageId: seed.id,
    url: seed.url || '',
    space: seed.space || '',
    claimed: Boolean(claimed?.at),
    claimedBy: claimed?.displayName || null,
    claimedAt: claimed?.at || null,
  };
});

/**
 * One-click Claim: current human (asUser) appends a short ADF note to the demo page
 * so Teamwork Graph picks them up as a contributor. Errors are returned for the UI.
 */
resolver.define('claimDemoPage', async ({ context }) => {
  const seed = await kvs.get('seed:page');
  const pageId = seed?.id || '3178497';

  let displayName = context.displayName || '';
  try {
    const meRes = await api.asUser().requestConfluence(route`/wiki/rest/api/user/current`);
    if (meRes.ok) {
      const me = await meRes.json();
      displayName = me.displayName || me.publicName || displayName;
    }
  } catch (_) {
    // fall through with whatever we have
  }
  if (!displayName) displayName = context.accountId || 'teammate';

  const result = await claimPageAsUser(pageId, displayName);
  if (!result.ok) return { ok: false, error: result.error, pageId };

  await kvs.set('seed:claimed', {
    at: new Date().toISOString(),
    displayName,
    accountId: context.accountId || '',
    pageId: String(pageId),
    version: result.version,
  });

  return {
    ok: true,
    pageId: result.pageId,
    title: result.title,
    version: result.version,
    note: result.note,
    displayName,
  };
});

/** Jira global page "Decision log": search + status/tag filters over every decision. */
resolver.define('getDecisionLog', async ({ payload }) => {
  const all = await listDecisions();
  const rows = filterLog(all, {
    query: String(payload?.query || '').slice(0, 200),
    status: ['all', 'active', 'superseded'].includes(payload?.status) ? payload.status : 'all',
    tag: String(payload?.tag || ''),
  });
  return { counts: logCounts(all), tags: allTags(all), decisions: rows.slice(0, 100).map(present), truncated: rows.length > 100 };
});

/** Best-effort display name of the signed-in user (no extra scopes: uses read:confluence-user). */
const currentDisplayName = async (context) => {
  try {
    const res = await api.asUser().requestConfluence(route`/wiki/rest/api/user/current`);
    if (res.ok) {
      const me = await res.json();
      return me.displayName || me.publicName || context.displayName || '';
    }
  } catch (_) {
    // ignore; owner falls back to "unknown"
  }
  return context.displayName || '';
};

/** Decision log page: record a new decision from the modal form. */
resolver.define('recordFromLog', async ({ payload, context }) => {
  const { input, error } = formToInput(payload?.form);
  if (error) return { error };
  const displayName = input.owner ? '' : await currentDisplayName(context);
  return recordDecision({ ...input, accountId: context.accountId, displayName });
});

/** Decision log page: supersede an existing decision with a new one. */
resolver.define('supersedeFromLog', async ({ payload, context }) => {
  const { input, error } = formToInput(payload?.form, { supersede: true });
  if (error) return { error };
  const displayName = input.owner ? '' : await currentDisplayName(context);
  const res = await supersedeDecision({ ...input, accountId: context.accountId, displayName });
  return res.error ? res : { ...res.decision, supersedes: res.previous?.id || input.decisionId };
});

/**
 * Decision log page, first run: load the fictional "Lumen Freight" sample decisions so a fresh
 * (production) install is demo-ready without the dev-only web trigger. Only allowed while the
 * store is empty; idempotent because each sample uses a stable sourceKey.
 */
resolver.define('loadSampleDecisions', async () => {
  const existing = await listDecisions();
  if (existing.length > 0) return { error: 'Sample decisions can only be loaded into an empty decision log.' };
  for (const [i, d] of DEMO_DECISIONS.entries()) {
    await upsertFromSource({ sourceKey: `sample:${i + 1}`, sourceType: 'seed', sourceTitle: 'Sample data (Lumen Freight, fictional)' }, d);
  }
  return { loaded: DEMO_DECISIONS.length };
});

export const handler = resolver.getDefinitions();
