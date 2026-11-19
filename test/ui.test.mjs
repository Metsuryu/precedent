import test from 'node:test';
import assert from 'node:assert/strict';
import { plural, statusBadge, decidedLine, panelSummary, countsLine } from '../src/lib/ui.js';

test('plural and status badge', () => {
  assert.equal(plural(1, 'decision'), '1 decision');
  assert.equal(plural(0, 'decision'), '0 decisions');
  assert.deepEqual(statusBadge({ status: 'active' }), { appearance: 'success', text: 'Active' });
  assert.deepEqual(statusBadge({}), { appearance: 'success', text: 'Active' });
  assert.deepEqual(statusBadge({ status: 'superseded', supersededBy: 'DEC-9' }), { appearance: 'moved', text: 'Superseded by DEC-9' });
  assert.equal(statusBadge({ status: 'superseded' }).text, 'Superseded');
});

test('decided line, panel summary and counts line', () => {
  assert.equal(decidedLine({ owner: 'Ana', decidedOn: '2026-01-10' }), 'Decided by Ana on 2026-01-10');
  assert.equal(decidedLine({}), 'Decided by unknown owner');
  assert.equal(panelSummary({ matches: [{}, {}], contradictions: 1, totalDecisions: 10 }).tone, 'warning');
  assert.equal(panelSummary({ matches: [{}, {}], contradictions: 1 }).title, 'May contradict 1 past decision');
  assert.equal(panelSummary({ matches: [{}], totalDecisions: 10 }).title, '1 related decision');
  assert.equal(panelSummary({ matches: [], totalDecisions: 1 }).tone, 'empty');
  assert.equal(countsLine({ total: 10, active: 8, superseded: 2 }), '10 decisions · 8 active · 2 superseded');
  assert.equal(countsLine(null), '');
});
