import test from 'node:test';
import assert from 'node:assert/strict';
import { pageAri, jiraProjectAri, teamsQuery, PAGE_PEOPLE_QUERY } from '../src/services/teamwork-graph.js';

test('builds Teamwork Graph ARIs', () => {
  assert.equal(pageAri('c1', '42'), 'ari:cloud:confluence:c1:page/42');
  assert.equal(jiraProjectAri('c1', '10000'), 'ari:cloud:jira:c1:project/10000');
});

test('teams query aliases one field per person and the project', () => {
  const q = teamsQuery(2, true);
  assert.match(q, /\$u0: ID!, \$u1: ID!, \$project: ID!/u);
  assert.match(q, /t1: atlassianUserInTeams\(userId: \$u1/u);
  assert.match(q, /projectTeams: atlassianTeamsBySpace\(spaceAri: \$project/u);
  assert.doesNotMatch(teamsQuery(1, false), /project/u);
});

test('page query uses only curated fields, first <= 25', () => {
  for (const f of ['confluencePageOwners', 'confluencePageCreator', 'confluencePageContributors', 'confluencePageLinkedConfluencePages']) assert.match(PAGE_PEOPLE_QUERY, new RegExp(f, 'u'));
  for (const n of PAGE_PEOPLE_QUERY.matchAll(/first: (\d+)/gu)) assert.ok(Number(n[1]) <= 25);
});
