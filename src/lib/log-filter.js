/**
 * Pure helpers for the Jira "Decision log" global page: filter, search and sort.
 * No Forge imports so it can be unit-tested with node --test.
 */
import { searchDecisions } from './matcher.js';

const refNum = (ref) => Number(String(ref || '').replace(/\D+/gu, '')) || 0;

/** Newest decision first: by decidedOn, then by DEC number. */
export const byNewest = (a, b) =>
  String(b.decidedOn || '').localeCompare(String(a.decidedOn || '')) || refNum(b.ref) - refNum(a.ref);

const asList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean);

/** Distinct tags across decisions, sorted, for the tag filter. */
export const allTags = (decisions) =>
  [...new Set(decisions.flatMap((d) => asList(d.tags).map((t) => t.toLowerCase())))].sort();

/**
 * Filter the decision log.
 * @param decisions raw stored decisions
 * @param opts { query, status: 'all'|'active'|'superseded', tag }
 * Plain substring hits (id, title, owner, text) are kept even when the ranker scores them low.
 */
export const filterLog = (decisions, { query = '', status = 'all', tag = '' } = {}) => {
  let out = decisions.slice();
  if (status && status !== 'all') out = out.filter((d) => (d.status || 'active') === status);
  if (tag) {
    const t = tag.toLowerCase();
    out = out.filter((d) => asList(d.tags).some((x) => x.toLowerCase() === t));
  }
  const q = String(query || '').trim();
  if (!q) return out.sort(byNewest);
  const ql = q.toLowerCase();
  const ranked = searchDecisions(q, out, { limit: out.length || 1 });
  const seen = new Set(ranked.map((r) => r.decision.ref));
  const substr = out
    .filter((d) => !seen.has(d.ref))
    .filter((d) => [d.ref, d.title, d.decision, d.rationale, d.owner].some((f) => String(f || '').toLowerCase().includes(ql)))
    .sort(byNewest);
  return [...ranked.map((r) => r.decision), ...substr];
};

/** Summary counts for the page header. */
export const logCounts = (decisions) => ({
  total: decisions.length,
  active: decisions.filter((d) => (d.status || 'active') === 'active').length,
  superseded: decisions.filter((d) => d.status === 'superseded').length,
});
