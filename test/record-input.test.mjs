import test from 'node:test';
import assert from 'node:assert/strict';
import {
  todayUTC,
  validateRecordFields,
  validateSupersedeFields,
  buildSourceMeta,
} from '../src/lib/record-input.js';
import { normalizeDecision } from '../src/store/decisions.js';

test('todayUTC formats YYYY-MM-DD in UTC', () => {
  assert.equal(todayUTC(new Date('2026-11-06T23:30:00Z')), '2026-11-06');
  assert.equal(todayUTC(new Date('2026-11-06T00:00:00Z')), '2026-11-06');
});

test('validateRecordFields requires title and decision', () => {
  assert.match(validateRecordFields({}), /title/i);
  assert.match(validateRecordFields({ title: 'x' }), /decision/i);
  assert.equal(validateRecordFields({ title: 'x', decision: 'y' }), null);
  assert.match(validateRecordFields({ title: '  ', decision: 'y' }), /title/i);
});

test('validateSupersedeFields requires old id plus record fields', () => {
  assert.match(validateSupersedeFields({ title: 'a', decision: 'b' }), /decision id/i);
  assert.match(validateSupersedeFields({ decisionId: 'DEC-1', title: 'a' }), /decision/i);
  assert.equal(validateSupersedeFields({ decisionId: 'DEC-1', title: 'a', decision: 'b' }), null);
});

test('buildSourceMeta prefers jira link when issueKey present', () => {
  const j = buildSourceMeta({ issueKey: 'mobl-58', accountId: 'acc-1', unique: 'u1' });
  assert.equal(j.sourceType, 'jira');
  assert.equal(j.sourceKey, 'jira:MOBL-58:u1');
  assert.equal(j.sourceUrl, '/browse/MOBL-58');
  assert.equal(j.sourceTitle, 'MOBL-58');
  assert.equal(j.recordedBy, 'acc-1');

  const a = buildSourceMeta({ unique: 'u2' });
  assert.equal(a.sourceType, 'action');
  assert.equal(a.sourceKey, 'action:u2');
  assert.equal(a.sourceUrl, undefined);
  assert.equal(a.recordedBy, '');
});

test('normalizeDecision defaults status and strips length', () => {
  const n = normalizeDecision({
    title: '  Hello  ',
    decision: 'Do the thing',
    status: 'nope',
    tags: 'alpha, beta',
    conflictTerms: ['no redis', 'no mongo'],
  });
  assert.equal(n.title, 'Hello');
  assert.equal(n.status, 'active');
  assert.deepEqual(n.tags, ['alpha', 'beta']);
  assert.equal(n.conflictTerms, 'no redis, no mongo');
  assert.equal(n.supersededBy, '');
});
