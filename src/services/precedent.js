/**
 * Core use cases shared by the Jira panel, the Rovo actions and dev tooling.
 * Keeping them here lets future surfaces (MCP module, Teamwork Graph enrichment)
 * reuse the same logic without touching the UI.
 */
import { kvs } from '@forge/kvs';
import { listDecisions, getDecision, getVersion, createDecision, markSuperseded } from '../store/decisions.js';
import { todayUTC, validateRecordFields, validateSupersedeFields, buildSourceMeta } from '../lib/record-input.js';
import { rankDecisions, searchDecisions } from '../lib/matcher.js';
import { fetchIssue } from './jira.js';
import { whoToAsk as twgWhoToAsk } from './teamwork-graph.js';

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
export const checkIssue = async (issueKey, { mode = 'user', limit = 5, version } = {}) => {
  const [issue, decisions] = await Promise.all([fetchIssue(issueKey, mode), listDecisions({ version })]);
  const matches = rankDecisions(issue, decisions, { limit });
  return {
    issue: { key: issue.key, id: issue.id, summary: issue.summary, labels: issue.labels, components: issue.components, projectId: issue.projectId },
    totalDecisions: decisions.length,
    contradictions: matches.filter((m) => m.conflict).length,
    matches: matches.map(presentMatch),
  };
};

/*
 * Per-issue match cache. Entries are written by the Jira issue trigger (precompute)
 * and by live checks, and are valid only for the decision-log version they were
 * computed against, so any decision change or issue edit invalidates them.
 * The cached payload holds decision data plus the issue's key/summary/labels, which
 * anyone viewing the panel can already see.
 */
const matchKey = (issueId) => `match:${issueId}`;
const CACHE_TTL = { value: 14, unit: 'DAYS' };

export const precomputeIssue = async (issueIdOrKey, { limit = 6 } = {}) => {
  const version = await getVersion();
  const result = await checkIssue(issueIdOrKey, { mode: 'app', limit, version });
  await kvs.set(matchKey(result.issue.id), { version, limit, at: Date.now(), result }, { ttl: CACHE_TTL });
  return result;
};

/**
 * Fast path for the issue panel: serve the precomputed result when it is still
 * current; otherwise compute live (as the user) and refresh the cache.
 */
export const checkIssueCached = async (issueId, { limit = 6, fresh = false } = {}) => {
  const [version, cached] = await Promise.all([getVersion(), fresh ? undefined : kvs.get(matchKey(issueId))]);
  if (cached && cached.version === version && cached.limit === limit) return { ...cached.result, cached: true };
  const result = await checkIssue(issueId, { mode: 'user', limit, version });
  await kvs.set(matchKey(result.issue.id), { version, limit, at: Date.now(), result }, { ttl: CACHE_TTL });
  return { ...result, cached: false };
};

export const forgetIssue = (issueId) => kvs.delete(matchKey(issueId));

/*
 * "Who decided / who to ask" via Teamwork Graph (as the current user), cached per
 * user + decision for a few hours since TWG results are permission-filtered.
 */
const pageIdOf = (d) => (d?.sourceType === 'confluence' ? String(d.sourceKey || '').split(':')[0] : undefined);

export const resolveCloudId = async (cloudId) => {
  if (cloudId) {
    kvs.set('meta:cloudId', cloudId).catch(() => {});
    return cloudId;
  }
  return kvs.get('meta:cloudId');
};

export const whoToAsk = async (id, { cloudId, accountId, projectId } = {}) => {
  const d = await getDecision(id);
  if (!d) return { error: `No decision found with id ${id}` };
  const cid = await resolveCloudId(cloudId);
  const cacheKey = accountId ? `twg:${accountId}:${d.ref}:${projectId || '-'}` : undefined;
  if (cacheKey) {
    const hit = await kvs.get(cacheKey);
    if (hit) return { ...hit, cached: true };
  }
  const people = await twgWhoToAsk({ cloudId: cid, pageId: pageIdOf(d), projectId });
  if (people.errors.length) console.warn(`TWG ${d.ref}: ${people.errors.join(' | ')}`);
  if (people.notes?.length) console.info(`TWG ${d.ref}: ${people.notes.join(' | ')}`);
  const out = {
    id: d.ref,
    title: d.title,
    recordedOwner: d.owner,
    source: d.sourceUrl ? { title: d.sourceTitle, url: d.sourceUrl } : undefined,
    ...people,
    note: 'People and teams come from Atlassian Teamwork Graph and only include what you can see. Empty lists can also mean the graph has no data for this page yet.',
  };
  // Cache only clean results so transient Preview errors are retried.
  if (cacheKey && !people.errors.length) await kvs.set(cacheKey, out, { ttl: { value: 6, unit: 'HOURS' } });
  return out;
};

export const search = async (query, { limit = 5 } = {}) => {
  const decisions = await listDecisions();
  return searchDecisions(query, decisions, { limit }).map(presentMatch);
};

export const detail = async (id) => present(await getDecision(id));

/**
 * Record a new decision via Rovo action / MCP / skill (or dev tooling).
 * Required: title + decision. owner defaults to displayName or "unknown";
 * decidedOn defaults to today UTC.
 */
export const recordDecision = async ({
  title,
  decision,
  rationale,
  owner,
  decidedOn,
  tags,
  components,
  conflictTerms,
  issueKey,
  accountId,
  displayName,
} = {}) => {
  const err = validateRecordFields({ title, decision });
  if (err) return { error: err };
  const who = String(owner || displayName || '').trim() || 'unknown';
  const when = String(decidedOn || '').trim() || todayUTC();
  const meta = buildSourceMeta({ issueKey, accountId });
  const created = await createDecision(
    { title, decision, rationale, owner: who, decidedOn: when, tags, components, conflictTerms, status: 'active' },
    meta,
  );
  return present(created);
};

/**
 * Supersede an existing decision: create the new one, then mark the old as superseded.
 * If the old id is missing, returns { error } without creating anything.
 */
export const supersedeDecision = async ({
  decisionId,
  title,
  decision,
  rationale,
  owner,
  decidedOn,
  tags,
  components,
  conflictTerms,
  issueKey,
  accountId,
  displayName,
} = {}) => {
  const err = validateSupersedeFields({ decisionId, title, decision });
  if (err) return { error: err };
  const old = await getDecision(decisionId);
  if (!old) return { error: `No decision found with id ${decisionId}` };
  const created = await recordDecision({
    title,
    decision,
    rationale,
    owner,
    decidedOn,
    tags,
    components,
    conflictTerms,
    issueKey,
    accountId,
    displayName,
  });
  if (created.error) return created;
  const previous = await markSuperseded(old.ref, created.id);
  return {
    previous: present(previous),
    decision: created,
  };
};

