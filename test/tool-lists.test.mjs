import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guards against the tool lists drifting apart: every Rovo action must be exposed by
// the MCP server, declared by the reusable skill, and allowed in the open SKILL.md.
const manifest = readFileSync(new URL('../manifest.yml', import.meta.url), 'utf8');
const skillMd = readFileSync(new URL('../skills/decision-check/SKILL.md', import.meta.url), 'utf8');

function block(name) {
  const lines = manifest.split('\n');
  const start = lines.findIndex((l) => l === '  ' + name + ':');
  assert.ok(start >= 0, 'missing module ' + name);
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  \S/.test(lines[i]) || /^\S/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}
function listAfter(lines, key) {
  const i = lines.findIndex((l) => l.trim() === key + ':');
  assert.ok(i >= 0, 'missing ' + key);
  const indent = lines[i + 1].indexOf('-');
  const items = [];
  for (let j = i + 1; j < lines.length && lines[j].indexOf('- ') === indent; j++) items.push(lines[j].trim().slice(2).trim());
  return items.sort();
}

test('actions, MCP tools, rovo:skill deps and SKILL.md allowed-tools match', () => {
  const actions = block('action').filter((l) => /^    - key: /.test(l)).map((l) => l.split('key:')[1].trim()).sort();
  assert.equal(actions.length, 7);
  assert.deepEqual(listAfter(block('rovo:mcp'), 'tools'), actions);
  assert.deepEqual(listAfter(block('rovo:skill'), 'tools'), actions);
  const allowed = skillMd.match(/^allowed-tools: (.+)$/m)[1].trim().split(/\s+/).sort();
  assert.deepEqual(allowed, actions);
});
