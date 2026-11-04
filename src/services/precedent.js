/**
 * Core use cases shared by the Jira panel, the Rovo actions and dev tooling.
 * Keeping them here lets future surfaces (MCP module, Teamwork Graph enrichment)
 * reuse the same logic without touching the UI.
 */
import { listDecisions, getDecision } from '../store/decisions.js';
import { rankDecisions, searchDecisions } from '../lib/matcher.js';
import { fetchIssue } from './jira.js';

/** Shape a decision for API/agent output (drops internal fields). */
export const present = (d) =>
  d && {
    id: d.ref,
    title: d.title,
    decision: d.decision,
    rationale: d.rationale,
    owner: d.owner,
    decidedOn: d.decidedOn,
    status: d.status,
    supersededBy: d.supersededBy || undefined,
    tags: d.tags,
    components: d.components,
    source: d.sourceUrl ? { title: d.sourceTitle, url: d.sourceUrl } : undefined,
  };

const presentMatch = (m) => ({
  ...present(m.decision),
  score: m.score,
  possibleContradiction: m.conflict,
  contradictionTerms: m.conflictTerms,
  why: m.reasons,
});

/** Check a Jira issue against all stored decisions. */
export const checkIssue = async (issueKey, { mode = 'user', limit = 5 } = {}) => {
  const [issue, decisions] = await Promise.all([fetchIssue(issueKey, mode), listDecisions()]);
  const matches = rankDecisions(issue, decisions, { limit });
  return {
    issue: { key: issue.key, summary: issue.summary, labels: issue.labels, components: issue.components },
    totalDecisions: decisions.length,
    contradictions: matches.filter((m) => m.conflict).length,
    matches: matches.map(presentMatch),
  };
};

export const search = async (query, { limit = 5 } = {}) => {
  const decisions = await listDecisions();
  return searchDecisions(query, decisions, { limit }).map(presentMatch);
};

export const detail = async (id) => present(await getDecision(id));
