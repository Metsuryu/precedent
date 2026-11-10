import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLog, allTags, logCounts, byNewest } from '../src/lib/log-filter.js';

const D = [
  { ref: 'DEC-1', title: 'No new datastores without an ADR', decision: 'Use Postgres only', owner: 'Ana', decidedOn: '2026-01-10', status: 'active', tags: ['datastore', 'Infra'] },
  { ref: 'DEC-2', title: 'Freeze API v1', decision: 'No breaking changes to v1', owner: 'Bo', decidedOn: '2026-03-01', status: 'superseded', supersededBy: 'DEC-3', tags: 'api' },
  { ref: 'DEC-3', title: 'API v1 sunset plan', decision: 'v1 read-only from June', owner: 'Bo', decidedOn: '2026-03-01', status: 'active', tags: ['api'] },
];

test('default: all decisions, newest first, ties by DEC number', () => {
  assert.deepEqual(filterLog(D).map((d) => d.ref), ['DEC-3', 'DEC-2', 'DEC-1']);
  assert.equal([...D].sort(byNewest)[0].ref, 'DEC-3');
});

test('status and tag filters', () => {
  assert.deepEqual(filterLog(D, { status: 'superseded' }).map((d) => d.ref), ['DEC-2']);
  assert.deepEqual(filterLog(D, { status: 'active', tag: 'API' }).map((d) => d.ref), ['DEC-3']);
  assert.deepEqual(filterLog(D, { tag: 'infra' }).map((d) => d.ref), ['DEC-1']);
});

test('query matches by keywords and by plain substring (id, owner)', () => {
  assert.ok(filterLog(D, { query: 'datastore' }).some((d) => d.ref === 'DEC-1'));
  assert.deepEqual(filterLog(D, { query: 'dec-2' }).map((d) => d.ref), ['DEC-2']);
  assert.ok(filterLog(D, { query: 'ana' }).every((d) => d.ref === 'DEC-1'));
  assert.equal(filterLog(D, { query: 'zzzz-nothing' }).length, 0);
});

test('tags and counts', () => {
  assert.deepEqual(allTags(D), ['api', 'datastore', 'infra']);
  assert.deepEqual(logCounts(D), { total: 3, active: 2, superseded: 1 });
});
