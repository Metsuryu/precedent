/**
 * UI Kit resolvers for the Confluence macro and the Jira issue panel.
 * The frontend calls these via `invoke(name, payload)`.
 */
import Resolver from '@forge/resolver';
import { upsertFromSource } from '../store/decisions.js';
import { checkIssueCached, whoToAsk } from '../services/precedent.js';

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

export const handler = resolver.getDefinitions();
