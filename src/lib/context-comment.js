/**
 * Builds the "Decision context" Jira comment (ADF) from a checkIssue() result.
 * Pure: no Forge APIs, so it is unit-tested directly.
 */
const text = (t, marks) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const strong = (t) => text(t, [{ type: 'strong' }]);
const link = (t, href) => text(t, [{ type: 'link', attrs: { href } }]);
const para = (...content) => ({ type: 'paragraph', content: content.filter(Boolean) });

const MAX_ITEMS = 5;
const clip = (s, n = 240) => {
  const v = String(s || '').replace(/\s+/g, ' ').trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};

const statusText = (m) =>
  m.status === 'superseded' ? (m.supersededBy ? `superseded by ${m.supersededBy}` : 'superseded') : 'active';

const itemFor = (m) => {
  const head = [strong(`${m.id}`), text(` ${clip(m.title, 120)} (${statusText(m)})`)];
  if (m.possibleContradiction) head.push(text(' — may contradict this issue', [{ type: 'strong' }, { type: 'textColor', attrs: { color: '#bf2600' } }]));
  const by = [`Decided by ${m.owner || 'unknown owner'}`, m.decidedOn ? `on ${m.decidedOn}` : ''].filter(Boolean).join(' ');
  const lines = [para(...head), para(text(clip(m.decision)))];
  const meta = [text(by)];
  if (m.source?.url) meta.push(text(' · '), link(clip(m.source.title || 'source', 80), m.source.url));
  if (m.possibleContradiction && m.contradictionTerms?.length) meta.push(text(` · conflicting terms: ${m.contradictionTerms.join(', ')}`));
  lines.push(para(...meta));
  return { type: 'listItem', content: lines };
};

/**
 * @param {object} result checkIssue() output: { issue, totalDecisions, contradictions, matches[] }
 * @param {{ note?: string }} [opts] optional human note (already confirmed by the user)
 * @returns {{ adf: object, summary: string, count: number }}
 */
export const buildContextComment = (result, { note } = {}) => {
  const matches = (result?.matches || []).slice(0, MAX_ITEMS);
  const conflicts = matches.filter((m) => m.possibleContradiction).length;
  const total = result?.totalDecisions ?? 0;
  let summary;
  if (!matches.length) summary = `No related decisions found among ${total} recorded.`;
  else if (conflicts) summary = `May contradict ${conflicts} past decision${conflicts === 1 ? '' : 's'}; ${matches.length} related in total.`;
  else summary = `${matches.length} related past decision${matches.length === 1 ? '' : 's'}; no conflicts found.`;

  const content = [para(strong('Decision context (Precedent)'))];
  content.push({
    type: 'panel',
    attrs: { panelType: conflicts ? 'warning' : matches.length ? 'info' : 'note' },
    content: [para(text(summary))],
  });
  if (note) content.push(para(text(clip(note, 500))));
  if (matches.length) content.push({ type: 'bulletList', content: matches.map(itemFor) });
  content.push(
    para(
      text(
        conflicts
          ? 'Talk to the decision owner before going ahead, or record a new decision that supersedes it.'
          : 'Generated from recorded team decisions. Ask Precedent in Rovo for details.',
        [{ type: 'em' }]
      )
    )
  );
  return { adf: { type: 'doc', version: 1, content }, summary, count: matches.length };
};
