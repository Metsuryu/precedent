import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContextComment } from '../src/lib/context-comment.js';

const m = (o) => ({ id: 'DEC-1', title: 'No new datastores without ADR', decision: 'Do not add datastores without an ADR.', owner: 'Platform', decidedOn: '2026-08-12', status: 'active', ...o });

test('conflict comment: warning panel, ids, owner, source link, terms', () => {
  const r = buildContextComment({ totalDecisions: 10, matches: [m({ possibleContradiction: true, contradictionTerms: ['redis'], source: { title: 'ADR page', url: 'https://x/wiki/1' } }), m({ id: 'DEC-4', status: 'superseded', supersededBy: 'DEC-9' })] });
  assert.equal(r.count, 2);
  assert.match(r.summary, /May contradict 1 past decision/);
  const json = JSON.stringify(r.adf);
  assert.equal(r.adf.type, 'doc');
  assert.match(json, /"panelType":"warning"/);
  assert.match(json, /DEC-1/);
  assert.match(json, /superseded by DEC-9/);
  assert.match(json, /"href":"https:\/\/x\/wiki\/1"/);
  assert.match(json, /conflicting terms: redis/);
  assert.match(json, /Decided by Platform on 2026-08-12/);
});

test('no matches and note; caps at 5 items', () => {
  const empty = buildContextComment({ totalDecisions: 3, matches: [] }, { note: 'Checked during refinement' });
  assert.match(empty.summary, /No related decisions found among 3/);
  assert.match(JSON.stringify(empty.adf), /Checked during refinement/);
  assert.match(JSON.stringify(empty.adf), /"panelType":"note"/);
  const many = buildContextComment({ totalDecisions: 9, matches: Array.from({ length: 8 }, (_, i) => m({ id: `DEC-${i}` })) });
  assert.equal(many.count, 5);
  assert.match(many.summary, /5 related past decisions; no conflicts/);
});
