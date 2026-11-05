/**
 * DEVELOPMENT-ONLY web trigger used to seed demo data and verify the backend
 * without a browser. Protected by a shared secret stored as an encrypted Forge
 * variable (DEV_KEY). It refuses to run outside the development environment.
 *
 *   GET  ?op=status            counts
 *   POST ?op=seed              create demo Confluence page + Jira issues + decisions
 *   GET  ?op=check&issue=KEY   run the matcher on an issue (as the app)
 *   GET  ?op=search&q=text     search decisions
 *   GET  ?op=sync&page=ID      re-sync one Confluence page
 *   GET  ?op=page-info[&page=ID]     page author/status/version + view/edit restrictions
 *   POST ?op=make-editable[&page=ID] clear blocking edit restrictions (probe v1 APIs)
 *
 * page-info / make-editable default to the seeded demo page (KVS seed:page, else 3178497).
 */
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { listDecisions, upsertFromSource, bumpVersion } from '../store/decisions.js';
import { checkIssue, search, present, precomputeIssue } from '../services/precedent.js';
import { MACRO_MODULE_KEY, syncPage, pageInfo, makeEditable } from '../services/confluence.js';
import { DEMO_DECISIONS, DEMO_ISSUES } from '../seed/demo-data.js';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': ['application/json'] },
  body: JSON.stringify(body, null, 2),
});
const q = (req, name) => req.queryParameters?.[name]?.[0];
const randomId = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/gu, () => Math.floor(Math.random() * 16).toString(16));

const para = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

/** ADF node for one instance of our Forge macro, with config in guestParams. */
const macroNode = (localId, guestParams) => {
  const appId = process.env.APP_UUID;
  const envId = process.env.ENV_UUID;
  const extensionKey = `${appId}/${envId}/static/${MACRO_MODULE_KEY}`;
  return {
    type: 'extension',
    attrs: {
      layout: 'default',
      extensionType: 'com.atlassian.ecosystem',
      extensionKey,
      text: 'Decision record (Development)',
      parameters: {
        layout: 'extension',
        guestParams,
        forgeEnvironment: 'DEVELOPMENT',
        extensionId: `ari:cloud:ecosystem::extension/${extensionKey}`,
        extensionTitle: 'Decision record (Development)',
        render: 'native',
        localId,
      },
      localId,
    },
  };
};

const seedConfluence = async (log) => {
  const existing = await kvs.get('seed:page');
  if (existing) {
    log.push(`confluence: page already seeded (${existing.id})`);
    return existing;
  }
  const spacesRes = await api.asApp().requestConfluence(route`/wiki/api/v2/spaces?limit=25&type=global`);
  const spaces = spacesRes.ok ? (await spacesRes.json()).results : [];
  log.push(`confluence: ${spaces.length} spaces visible (HTTP ${spacesRes.status})`);
  const macros = DEMO_DECISIONS.map((d) => ({ localId: randomId(), d }));
  const adf = {
    type: 'doc',
    version: 1,
    content: [
      para('Fictional demo data for Lumen Freight, an invented company. Each block below is a Precedent "Decision record" macro.'),
      ...macros.map((m) => macroNode(m.localId, m.d)),
    ],
  };
  for (const s of spaces) {
    const res = await api.asApp().requestConfluence(route`/wiki/api/v2/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        spaceId: s.id,
        status: 'current',
        title: 'Engineering decision log (Precedent demo)',
        body: { representation: 'atlas_doc_format', value: JSON.stringify(adf) },
      }),
    });
    if (res.ok) {
      const page = await res.json();
      const url = `${page._links?.base || ''}${page._links?.webui || ''}`;
      const seeded = { id: page.id, url, space: s.key, macros: macros.map((m) => m.localId) };
      await kvs.set('seed:page', seeded);
      log.push(`confluence: created page ${page.id} in space ${s.key}`);
      // Write decisions directly as well, so we don't depend on trigger timing.
      for (const m of macros) {
        await upsertFromSource({ sourceKey: `${page.id}:${m.localId}`, sourceType: 'confluence', sourceUrl: url, sourceTitle: page.title }, m.d);
      }
      return seeded;
    }
    log.push(`confluence: space ${s.key} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  // Fallback: store decisions without a page.
  for (const [i, d] of DEMO_DECISIONS.entries()) {
    await upsertFromSource({ sourceKey: `seed:${i + 1}`, sourceType: 'seed', sourceTitle: 'Demo seed' }, d);
  }
  log.push('confluence: no writable space; stored decisions without a page');
  return null;
};

const seedJira = async (log, projectKey) => {
  const existing = await kvs.get('seed:issues');
  if (existing?.length) {
    log.push(`jira: issues already seeded (${existing.join(', ')})`);
    return existing;
  }
  let key = projectKey;
  if (!key) {
    const pr = await api.asApp().requestJira(route`/rest/api/3/project/search?maxResults=50&typeKey=software`);
    const projects = pr.ok ? (await pr.json()).values : [];
    log.push(`jira: ${projects.length} software projects visible`);
    key = projects[0]?.key;
  }
  if (!key) throw new Error('No Jira project found');
  const pj = await (await api.asApp().requestJira(route`/rest/api/3/project/${key}`)).json();
  const type = (pj.issueTypes || []).find((t) => !t.subtask && /task/iu.test(t.name)) || (pj.issueTypes || []).find((t) => !t.subtask);
  const keys = [];
  for (const i of DEMO_ISSUES) {
    const res = await api.asApp().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        fields: {
          project: { key },
          issuetype: { id: type.id },
          summary: i.summary,
          description: { type: 'doc', version: 1, content: [para(i.description)] },
          labels: i.labels,
        },
      }),
    });
    if (res.ok) keys.push((await res.json()).key);
    else log.push(`jira: create failed HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  await kvs.set('seed:issues', keys);
  log.push(`jira: created ${keys.join(', ')} in ${key} (type ${type?.name})`);
  return keys;
};

export const devtools = async (req, context) => {
  if (!process.env.DEV_KEY || q(req, 'key') !== process.env.DEV_KEY) return json(401, { error: 'unauthorized' });
  if (process.env.ENV_NAME !== 'development') return json(403, { error: 'dev only' });
  const op = q(req, 'op') || 'status';
  try {
    if (op === 'status') {
      const ds = await listDecisions();
      return json(200, {
        decisions: ds.map((d) => `${d.ref} [${d.status}] ${d.title} (${d.sourceType})`),
        seedPage: await kvs.get('seed:page'),
        seedIssues: await kvs.get('seed:issues'),
      });
    }
    if (op === 'seed') {
      const log = [];
      const page = await seedConfluence(log);
      const issues = await seedJira(log, q(req, 'project'));
      return json(200, { log, page, issues });
    }
    if (op === 'check') return json(200, await checkIssue(q(req, 'issue'), { mode: 'app', limit: 5 }));
    if (op === 'precompute') return json(200, await precomputeIssue(q(req, 'issue')));
    if (op === 'twg-app') {
      // Probe: Teamwork Graph is user-context only; this documents what asApp returns.
      const app = api.asApp();
      if (typeof app.requestTeamworkGraph !== 'function') return json(200, { asApp: 'requestTeamworkGraph is not available on asApp() (user context only)' });
      try {
        const res = await app.requestTeamworkGraph('query { echo(myString: "ping") }');
        return json(200, { status: res.status, body: String(await res.text()).slice(0, 500) });
      } catch (e) {
        return json(200, { asApp: 'threw', message: String(e.message || e) });
      }
    }
    if (op === 'search') return json(200, await search(q(req, 'q') || ''));
    if (op === 'sync') return json(200, await syncPage(q(req, 'page')));
    if (op === 'reset-decisions') {
      // Dev only: wipe decisions + counter (keeps seeded page/issues).
      const ds = await listDecisions();
      for (const d of ds) await kvs.entity('decision').delete(d.key);
      await kvs.delete('seq:decision');
      await bumpVersion();
      return json(200, { deleted: ds.length });
    }
    if (op === 'list') return json(200, (await listDecisions()).map(present));
    if (op === 'page-info' || op === 'make-editable') {
      const seed = await kvs.get('seed:page');
      const pageId = q(req, 'page') || seed?.id || '3178497';
      if (op === 'page-info') return json(200, await pageInfo(pageId));
      return json(200, await makeEditable(pageId));
    }
    return json(400, { error: `unknown op ${op}` });
  } catch (e) {
    return json(500, { error: String(e.message || e), stack: String(e.stack || '').split('\n').slice(0, 5) });
  }
};
