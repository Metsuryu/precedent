/**
 * UI Kit resolvers for the Confluence macro and the Jira issue panel.
 * The frontend calls these via `invoke(name, payload)`.
 */
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { upsertFromSource, listDecisions } from '../store/decisions.js';
import { checkIssueCached, whoToAsk, present } from '../services/precedent.js';
import { filterLog, allTags, logCounts } from '../lib/log-filter.js';
import { claimPageAsUser } from '../services/confluence.js';

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

export const handler = resolver.getDefinitions();
