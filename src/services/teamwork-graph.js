/**
 * Teamwork Graph (Preview) reads for "who decided / who to ask".
 *
 * Uses only Atlassian-maintained *curated queries* (typed GraphQL fields, no ad-hoc
 * Cypher), always as the current user, so results are permission-filtered for them.
 * Runs on Atlassian: the call goes through Forge's requestTeamworkGraph.
 *
 * Scopes (manifest): read:graph:page:confluence, read:graph:user:atlassian,
 * read:graph:team:atlassian, read:graph:project:jira.
 * Note: a missing/declined scope makes TWG return *empty* results, not errors.
 */
import api from '@forge/api';

export const pageAri = (cloudId, pageId) => `ari:cloud:confluence:${cloudId}:page/${pageId}`;
export const jiraProjectAri = (cloudId, projectId) => `ari:cloud:jira:${cloudId}:project/${projectId}`;

const USER = '... on AtlassianUser { id accountId name }';
const TEAM = '... on AtlassianTeam { id displayName profileUrl }';

/** Who created / owns / contributed to the decision page, and what it links to. */
export const PAGE_PEOPLE_QUERY = `query precedent_pagePeople($page: ID!) {
  owners: confluencePageOwners(id: $page, first: 5) { edges { node { ${USER} } } }
  creator: confluencePageCreator(id: $page, first: 1) { edges { node { ${USER} } } }
  contributors: confluencePageContributors(id: $page, first: 10) { edges { node { ${USER} } } }
  linked: confluencePageLinkedConfluencePages(id: $page, first: 5) { edges { node { ... on ConfluencePage { id title webUrl } } } }
}`;

/** Teams of up to three people (aliases u0..u2) plus teams linked to the issue's project. */
export const teamsQuery = (userCount, withProject) => {
  const vars = [...Array(userCount).keys()].map((i) => `$u${i}: ID!`);
  if (withProject) vars.push('$project: ID!');
  const fields = [...Array(userCount).keys()].map((i) => `t${i}: atlassianUserInTeams(userId: $u${i}, first: 5) { edges { node { ${TEAM} } } }`);
  if (withProject) fields.push(`projectTeams: atlassianTeamsBySpace(spaceAri: $project, first: 5) { edges { node { ${TEAM} } } }`);
  return `query precedent_teams(${vars.join(', ')}) {\n  ${fields.join('\n  ')}\n}`;
};

const nodes = (conn) => (conn?.edges || []).map((e) => e?.node).filter(Boolean);
const uniqBy = (arr, key) => [...new Map(arr.map((x) => [x[key], x])).values()];

/** Run a TWG query as the current user; returns { data, errors } and never throws. */
const run = async (query, variables) => {
  try {
    const res = await api.asUser().requestTeamworkGraph(query, variables);
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { json = { errors: [{ message: `HTTP ${res.status}: ${text.slice(0, 200)}` }] }; }
    if (!res.ok && !json.errors) json.errors = [{ message: `HTTP ${res.status}` }];
    return json;
  } catch (e) {
    return { errors: [{ message: String(e.message || e) }] };
  }
};

/**
 * Build the "who to ask" picture for one decision (and optionally the issue's project).
 * @returns {{ owners, creator, contributors, teams, projectTeams, linkedPages, errors }}
 */
export const whoToAsk = async ({ cloudId, pageId, projectId }) => {
  const out = { owners: [], creator: null, contributors: [], teams: [], projectTeams: [], linkedPages: [], errors: [] };
  if (!cloudId) return { ...out, errors: ['missing cloudId'] };

  let people = [];
  if (pageId) {
    const r = await run(PAGE_PEOPLE_QUERY, { page: pageAri(cloudId, pageId) });
    if (r.errors?.length) out.errors.push(...r.errors.map((e) => e.message));
    const d = r.data || {};
    out.owners = nodes(d.owners);
    out.creator = nodes(d.creator)[0] || null;
    out.contributors = nodes(d.contributors);
    out.linkedPages = nodes(d.linked).map((p) => ({ title: p.title, url: p.webUrl }));
    people = uniqBy([...out.owners, ...(out.creator ? [out.creator] : []), ...out.contributors], 'id').slice(0, 3);
  }

  if (people.length || projectId) {
    const vars = {};
    people.forEach((p, i) => { vars[`u${i}`] = p.id; });
    if (projectId) vars.project = jiraProjectAri(cloudId, projectId);
    const r = await run(teamsQuery(people.length, Boolean(projectId)), vars);
    if (r.errors?.length) out.errors.push(...r.errors.map((e) => e.message));
    const d = r.data || {};
    const teams = people.flatMap((p, i) => nodes(d[`t${i}`]).map((t) => ({ ...t, member: p.name })));
    out.teams = uniqBy(teams, 'id');
    out.projectTeams = nodes(d.projectTeams);
  }
  // Strip internal ids from people for output; keep accountId for UI <User> rendering.
  const person = (u) => u && { accountId: u.accountId, name: u.name };
  return {
    owners: out.owners.map(person),
    creator: person(out.creator),
    contributors: out.contributors.map(person),
    teams: out.teams.map((t) => ({ name: t.displayName, url: t.profileUrl, via: t.member })),
    projectTeams: out.projectTeams.map((t) => ({ name: t.displayName, url: t.profileUrl })),
    linkedPages: out.linkedPages,
    errors: out.errors,
  };
};
