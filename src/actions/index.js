/**
 * Rovo actions used by the "Precedent" agent (and reusable by other agents).
 * Each handler receives the action inputs plus a `context` object from Rovo.
 * Errors are returned as plain messages so the agent can explain them.
 */
import { checkIssue, detail, search, whoToAsk, recordDecision, supersedeDecision } from '../services/precedent.js';
import { fetchIssue } from '../services/jira.js';

const ISSUE_KEY = /\b[A-Z][A-Z0-9_]+-\d+\b/u;

const safe = (fn) => async (payload) => {
  try {
    return await fn(payload || {});
  } catch (e) {
    console.error('action failed', e);
    return { error: String(e.message || e) };
  }
};

/** Pull accountId / displayName from Rovo context when present (never required). */
const actorFrom = (context) => ({
  accountId: context?.accountId || context?.userId || undefined,
  displayName: context?.displayName || context?.userDisplayName || undefined,
});

/** search-decisions: free-text search across recorded decisions. */
export const searchDecisionsAction = safe(async ({ query }) => {
  if (!query) return { error: 'Provide a search query, e.g. "datastore" or "API v1".' };
  const results = await search(query, { limit: 5 });
  return { query, count: results.length, results };
});

/** get-decision: full record for one decision id (e.g. DEC-3). */
export const getDecisionAction = safe(async ({ decisionId }) => {
  const d = await detail(decisionId);
  return d || { error: `No decision found with id ${decisionId}` };
});

/** check-issue: compare a Jira issue against past decisions; falls back to the issue in context. */
export const checkIssueAction = safe(async (payload) => {
  const fromInput = String(payload.issueKey || '').toUpperCase().match(ISSUE_KEY)?.[0];
  const fromContext = payload.context?.jira?.issueKey;
  const key = fromInput || fromContext;
  if (!key) return { error: 'Provide a Jira issue key such as PROJ-123.' };
  return checkIssue(key, { mode: 'user', limit: 5 });
});

/**
 * who-to-ask: Teamwork Graph view of who decided and who to ask about a decision
 * (page owners/creator/contributors, their teams, linked pages, and teams linked
 * to the issue's project when an issue key is given or in context).
 */
export const whoToAskAction = safe(async (payload) => {
  const id = String(payload.decisionId || '').trim();
  if (!id) return { error: 'Provide a decision id such as DEC-3.' };
  const issueKey = String(payload.issueKey || '').toUpperCase().match(ISSUE_KEY)?.[0] || payload.context?.jira?.issueKey;
  let projectId;
  if (issueKey) projectId = (await fetchIssue(issueKey, 'user').catch(() => ({}))).projectId;
  return whoToAsk(id, { cloudId: payload.context?.cloudId, accountId: payload.context?.accountId, projectId });
});

/** record-decision: create a new active decision (optionally linked to a Jira issue). */
export const recordDecisionAction = safe(async (payload) => {
  const issueKey =
    String(payload.issueKey || '').toUpperCase().match(ISSUE_KEY)?.[0] || payload.context?.jira?.issueKey;
  const actor = actorFrom(payload.context);
  return recordDecision({
    title: payload.title,
    decision: payload.decision,
    rationale: payload.rationale,
    owner: payload.owner,
    decidedOn: payload.decidedOn,
    tags: payload.tags,
    components: payload.components,
    conflictTerms: payload.conflictTerms,
    issueKey,
    accountId: actor.accountId,
    displayName: actor.displayName,
  });
});

/**
 * supersede-decision: record a new decision and mark the old one supersededBy it.
 * Requires decisionId of the OLD decision plus title + decision for the NEW one.
 */
export const supersedeDecisionAction = safe(async (payload) => {
  const issueKey =
    String(payload.issueKey || '').toUpperCase().match(ISSUE_KEY)?.[0] || payload.context?.jira?.issueKey;
  const actor = actorFrom(payload.context);
  return supersedeDecision({
    decisionId: payload.decisionId,
    title: payload.title,
    decision: payload.decision,
    rationale: payload.rationale,
    owner: payload.owner,
    decidedOn: payload.decidedOn,
    tags: payload.tags,
    components: payload.components,
    conflictTerms: payload.conflictTerms,
    issueKey,
    accountId: actor.accountId,
    displayName: actor.displayName,
  });
});
