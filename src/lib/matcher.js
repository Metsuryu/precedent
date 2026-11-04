/**
 * Relevance matching between a Jira issue and stored decisions (v1).
 *
 * Score = tag/component/label overlap (strong signal)
 *       + BM25-style keyword overlap (title weighted higher)
 * Then each relevant decision is checked for a possible contradiction.
 * Pure functions only, so they are unit-testable outside Forge.
 */
import { tokenize, toList } from './text.js';
import { detectConflict } from './conflicts.js';

const TAG_WEIGHT = 3;
const MIN_SCORE = 2.5;
const RELATIVE_CUTOFF = 0.45; // drop matches far weaker than the best one

/** Build a weighted bag of words for a decision. */
const decisionTokens = (d) => [
  ...tokenize(d.title), ...tokenize(d.title), // title counts twice
  ...tokenize(d.decision),
  ...tokenize(d.rationale),
  ...toList(d.tags).flatMap(tokenize),
  ...toList(d.components).flatMap(tokenize),
  ...toList(d.conflictTerms).flatMap(tokenize),
];

/** Plain text of an issue used for keyword + conflict matching. */
export const issueText = (issue) =>
  [issue.summary, issue.description, (issue.labels || []).join(' '), (issue.components || []).join(' ')].join('. ');

/**
 * Rank decisions for an issue.
 * @param {object} issue { key, summary, description, labels[], components[] }
 * @param {object[]} decisions stored decision records
 * @param {object} opts { limit }
 * @returns {object[]} [{ decision, score, reasons[], conflict, conflictTerms[] }]
 */
export const rankDecisions = (issue, decisions, { limit = 5, minScore = MIN_SCORE, minKeywords = 2 } = {}) => {
  if (!decisions.length) return [];
  const text = issueText(issue);
  const qTokens = [...new Set(tokenize(text))];
  const issueTags = new Set([...(issue.labels || []), ...(issue.components || [])].flatMap((t) => toList(t)));

  // Document frequencies for IDF.
  const docs = decisions.map((d) => decisionTokens(d));
  const avgLen = docs.reduce((n, t) => n + t.length, 0) / docs.length || 1;
  const df = new Map();
  for (const toks of docs) for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;

  const results = decisions.map((d, i) => {
    const toks = docs[i];
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    const reasons = [];
    let score = 0;

    // BM25 (k1=1.2, b=0.75)
    const matched = [];
    for (const q of qTokens) {
      const f = tf.get(q);
      if (!f) continue;
      const idf = Math.log(1 + (N - df.get(q) + 0.5) / (df.get(q) + 0.5));
      score += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * toks.length) / avgLen));
      matched.push(q);
    }
    if (matched.length) reasons.push(`shared keywords: ${matched.slice(0, 6).join(', ')}`);

    // Tags / components vs. issue labels / components.
    const dTags = [...toList(d.tags), ...toList(d.components)];
    const tagHits = dTags.filter((t) => issueTags.has(t));
    if (tagHits.length) {
      score += TAG_WEIGHT * tagHits.length;
      reasons.push(`matching labels/components: ${tagHits.join(', ')}`);
    }

    const { conflict, terms } = detectConflict(d, text);
    if (conflict) {
      score += 2; // a contradiction is always worth surfacing
      reasons.unshift(`mentions ${terms.map((t) => `"${t}"`).join(', ')}, which this decision rules out`);
    }
    // Relevance gate: a single shared keyword is not enough on its own.
    const relevant = conflict || tagHits.length > 0 || matched.length >= minKeywords;
    return { decision: d, score: relevant ? Math.round(score * 100) / 100 : 0, reasons, conflict, conflictTerms: terms };
  });

  const best = Math.max(0, ...results.map((r) => r.score));
  return results
    .filter((r) => r.score >= minScore && (r.conflict || r.score >= best * RELATIVE_CUTOFF))
    .sort((a, b) => Number(b.conflict) - Number(a.conflict) || b.score - a.score)
    .slice(0, limit);
};

/** Free-text search over decisions (used by the Rovo "search decisions" action). */
export const searchDecisions = (query, decisions, opts = {}) =>
  rankDecisions({ summary: query, labels: toList(query) }, decisions, { minScore: 1, minKeywords: 1, ...opts }).map((r) => ({
    ...r,
    conflict: false,
    conflictTerms: [],
    reasons: r.reasons.filter((x) => !x.startsWith('mentions')),
  }));
