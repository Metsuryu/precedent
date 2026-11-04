/**
 * Rovo actions used by the "Precedent" agent (and reusable by other agents).
 * Each handler receives the action inputs plus a `context` object from Rovo.
 * Errors are returned as plain messages so the agent can explain them.
 */
import { checkIssue, detail, search } from '../services/precedent.js';

const ISSUE_KEY = /\b[A-Z][A-Z0-9_]+-\d+\b/u;

const safe = (fn) => async (payload) => {
  try {
    return await fn(payload || {});
  } catch (e) {
    console.error('action failed', e);
    return { error: String(e.message || e) };
  }
};

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
