import test from 'node:test';
import assert from 'node:assert/strict';
import { rankDecisions, searchDecisions } from '../src/lib/matcher.js';
import { extractRestrictedPhrases } from '../src/lib/conflicts.js';
import { extractDecisionMacros } from '../src/lib/adf-macros.js';
import { DEMO_DECISIONS, DEMO_ISSUES } from '../src/seed/demo-data.js';

const decisions = DEMO_DECISIONS.map((d, i) => ({ ...d, ref: `DEC-${i + 1}`, status: d.status || 'active', tags: d.tags.split(', '), components: [d.components] }));
const top = (issue) => rankDecisions(issue, decisions);

test('extracts restricted phrases', () => {
  assert.ok(extractRestrictedPhrases('No new datastores without an ADR').includes('datastores'));
  assert.ok(extractRestrictedPhrases('Do not add new endpoints to API v1').length > 0);
});

test('Redis cache issue contradicts the datastore decision', () => {
  const r = top(DEMO_ISSUES[0]);
  assert.equal(r[0].decision.ref, 'DEC-1');
  assert.equal(r[0].conflict, true);
});

test('v1 endpoint issue contradicts API freeze', () => {
  const r = top(DEMO_ISSUES[1]);
  assert.equal(r[0].decision.ref, 'DEC-2');
  assert.equal(r[0].conflict, true);
});

test('remember me contradicts admin session decision', () => {
  const r = top(DEMO_ISSUES[2]);
  assert.equal(r[0].decision.ref, 'DEC-4');
  assert.equal(r[0].conflict, true);
});

test('OpenTelemetry issue is related but aligned', () => {
  const r = top(DEMO_ISSUES[3]);
  assert.equal(r[0].decision.ref, 'DEC-3');
  assert.equal(r[0].conflict, false);
});

test('feature flag rollout is related but aligned', () => {
  const r = top(DEMO_ISSUES[4]);
  assert.equal(r[0].decision.ref, 'DEC-5');
  assert.equal(r.some((m) => m.conflict), false);
});

test('unrelated issue has no matches', () => {
  assert.equal(top(DEMO_ISSUES[5]).length, 0);
});

test('superseded decisions never flag contradictions', () => {
  const r = top({ summary: 'Use REST polling for shipment tracking updates', labels: ['tracking'] });
  const old = r.find((m) => m.decision.ref === 'DEC-6');
  assert.ok(old && old.conflict === false);
  assert.ok(r.find((m) => m.decision.ref === 'DEC-7')?.conflict);
});

test('search finds by topic', () => {
  assert.equal(searchDecisions('datastore', decisions)[0].decision.ref, 'DEC-1');
  assert.equal(searchDecisions('admin sessions', decisions)[0].decision.ref, 'DEC-4');
});

test('extracts macros from ADF', () => {
  const adf = { type: 'doc', content: [{ type: 'extension', attrs: { extensionKey: 'a/b/static/precedent-decision-record', parameters: { localId: 'x1', guestParams: { title: 'T' } } } }] };
  assert.deepEqual(extractDecisionMacros(adf), [{ localId: 'x1', params: { title: 'T' } }]);
});
