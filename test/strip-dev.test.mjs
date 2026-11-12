import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripDev } from '../scripts/strip-dev.mjs';

test('stripDev removes dev-only blocks from the real manifest', () => {
  const src = readFileSync(new URL('../manifest.yml', import.meta.url), 'utf8');
  const out = stripDev(src);
  assert.ok(src.includes('devtools'));
  assert.ok(!out.includes('devtools'));
  assert.ok(!out.includes('webtrigger'));
  assert.ok(out.includes('precedent-decision-log'));
});

test('stripDev rejects unterminated blocks', () => {
  assert.throws(() => stripDev('a\n# >>> dev-only\nb\n'));
});
