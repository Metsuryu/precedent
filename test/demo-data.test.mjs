import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_DECISIONS } from '../src/seed/demo-data.js';

test('sample decisions are complete, unique and dated', () => {
  assert.ok(DEMO_DECISIONS.length >= 5);
  const titles = new Set();
  for (const d of DEMO_DECISIONS) {
    for (const f of ['title', 'decision', 'owner', 'decidedOn']) assert.ok(String(d[f] || '').trim(), `${d.title}: ${f}`);
    assert.match(d.decidedOn, /^\d{4}-\d{2}-\d{2}$/u);
    assert.ok(!titles.has(d.title), `duplicate ${d.title}`);
    titles.add(d.title);
  }
});
