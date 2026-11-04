/**
 * Contradiction detection, v1 (deterministic).
 *
 * A decision can rule things out explicitly via its "conflict terms" field
 * (e.g. "redis, mongodb"), and implicitly via restrictive phrasing in the
 * decision text ("No new datastores", "Do not use X", "avoid Y", "deprecate Z").
 * If an issue mentions one of those terms, we flag a *possible* contradiction.
 * The Rovo agent can then reason about it in natural language.
 */
import { normalizePhrase, toList, tokenize } from './text.js';

// Restrictive cue followed by the thing being restricted (captured, up to 4 words).
const RESTRICTIVE = /\b(?:no new|no more|no|never|avoid|stop using|do not use|don t use|must not use|must not add|do not add|deprecate|deprecated|deprecating|ban|forbid|disallow|instead of|not allowed)\s+((?:[a-z0-9]+\s?){1,4})/gu;
const BREAK_WORDS = new Set(['without', 'unless', 'except', 'for', 'in', 'on', 'by', 'until', 'before', 'after', 'and', 'or', 'with', 'is', 'are', 'be', 'the', 'to']);

/** Pull candidate restricted phrases out of free text. */
export const extractRestrictedPhrases = (text) => {
  const norm = normalizePhrase(text).replace(/\bdon t\b/gu, 'don t');
  const found = [];
  for (const m of norm.matchAll(RESTRICTIVE)) {
    const words = [];
    for (const w of m[1].trim().split(' ')) {
      if (BREAK_WORDS.has(w)) break;
      words.push(w);
    }
    if (words.length) found.push(words.join(' '));
  }
  return [...new Set(found)];
};

/** All terms that, if proposed by an issue, may contradict this decision. */
export const conflictTermsFor = (decision) => {
  const explicit = toList(decision.conflictTerms);
  const implicit = extractRestrictedPhrases(`${decision.title || ''}. ${decision.decision || ''}`);
  return [...new Set([...explicit, ...implicit])];
};

/**
 * Check one issue text against one decision.
 * Returns { conflict: boolean, terms: string[] } — the terms that triggered it.
 */
export const detectConflict = (decision, issueText) => {
  if ((decision.status || 'active') !== 'active') return { conflict: false, terms: [] };
  const issuePhrase = ` ${normalizePhrase(issueText)} `;
  const issueTokens = new Set(tokenize(issueText));
  const hits = [];
  for (const term of conflictTermsFor(decision)) {
    const phrase = normalizePhrase(term);
    if (!phrase) continue;
    // Exact phrase match, or every (stemmed) word of the term appears in the issue.
    const termTokens = tokenize(phrase);
    const phraseHit = issuePhrase.includes(` ${phrase} `);
    const tokenHit = termTokens.length > 0 && termTokens.every((t) => issueTokens.has(t));
    if (phraseHit || tokenHit) hits.push(term);
  }
  return { conflict: hits.length > 0, terms: hits };
};
