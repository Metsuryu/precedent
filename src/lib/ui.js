/**
 * Pure presentation helpers shared by the issue panel and the Decision log,
 * so status badges and counts read the same everywhere. No React imports (unit-testable).
 */

/** "1 decision" / "3 decisions". */
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** Lozenge appearance + label for a decision's status (active / superseded). */
export const statusBadge = (d = {}) => {
  if (d.status === 'superseded') {
    return { appearance: 'moved', text: d.supersededBy ? `Superseded by ${d.supersededBy}` : 'Superseded' };
  }
  return { appearance: 'success', text: 'Active' };
};

/** One-line "Decided by X on 2026-01-10" provenance, without dangling words. */
export const decidedLine = (d = {}) => {
  const owner = d.owner ? String(d.owner).trim() : '';
  const on = d.decidedOn ? ` on ${d.decidedOn}` : '';
  return `Decided by ${owner || 'unknown owner'}${on}`;
};

/** Issue panel headline for the result of a check. */
export const panelSummary = ({ matches = [], contradictions = 0, totalDecisions = 0 } = {}) => {
  if (contradictions > 0) {
    return {
      tone: 'warning',
      title: `May contradict ${plural(contradictions, 'past decision')}`,
      text: 'Check with the decision owner before going ahead, or record a decision that supersedes it.',
    };
  }
  if (matches.length > 0) {
    return { tone: 'info', title: `${plural(matches.length, 'related decision')}`, text: `Out of ${totalDecisions} recorded. No conflicts found.` };
  }
  return { tone: 'empty', title: 'No related decisions', text: `Checked ${plural(totalDecisions, 'recorded decision')}. Nothing relevant to this issue.` };
};

/** Decision log counts line, e.g. "10 decisions · 8 active · 2 superseded". */
export const countsLine = (c) => {
  if (!c) return '';
  return `${plural(c.total || 0, 'decision')} · ${c.active || 0} active · ${c.superseded || 0} superseded`;
};
