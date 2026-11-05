/**
 * Confluence helpers: read a page's ADF and extract our "Decision record" macros,
 * so decisions can be (re)synced server-side from page events — no page view needed.
 * Also: page-info / make-editable helpers used by the development web trigger.
 */
import api, { route } from '@forge/api';
import { upsertFromSource, deleteMissingForPage } from '../store/decisions.js';

import { MACRO_MODULE_KEY, extractDecisionMacros } from '../lib/adf-macros.js';

export { MACRO_MODULE_KEY, extractDecisionMacros };

/** Fetch a page (as the app) with its body in ADF. */
export const fetchPage = async (pageId) => {
  const res = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`);
  if (!res.ok) throw new Error(`Confluence page ${pageId}: HTTP ${res.status}`);
  const page = await res.json();
  const raw = page.body?.atlas_doc_format?.value;
  return { page, adf: raw ? JSON.parse(raw) : null };
};

/** Sync all decision macros on a page into storage. Returns the refs touched. */
export const syncPage = async (pageId, siteUrl = '') => {
  const { page, adf } = await fetchPage(pageId);
  const macros = extractDecisionMacros(adf).filter((m) => m.localId && m.params.title);
  const base = siteUrl || page._links?.base || '';
  const url = page._links?.webui ? `${base}${page._links.webui}` : '';
  const refs = [];
  for (const m of macros) {
    const rec = await upsertFromSource(
      { sourceKey: `${pageId}:${m.localId}`, sourceType: 'confluence', sourceUrl: url, sourceTitle: page.title, recordedBy: page.authorId },
      m.params
    );
    refs.push(rec.ref);
  }
  const removed = await deleteMissingForPage(pageId, macros.map((m) => `${pageId}:${m.localId}`));
  return { refs, removed };
};

/** Summarise one restriction operation bucket (read/update) for logs/JSON. */
const summariseOp = (bucket) => {
  if (!bucket) return null;
  const users = (bucket.restrictions?.user?.results || []).map((u) => ({
    accountId: u.accountId,
    displayName: u.displayName,
    type: u.type,
  }));
  const groups = (bucket.restrictions?.group?.results || []).map((g) => ({
    id: g.id,
    name: g.name,
  }));
  return {
    operation: bucket.operation,
    userCount: users.length,
    groupCount: groups.length,
    users,
    groups,
  };
};

/**
 * Page metadata + current view/edit restrictions (v1 restriction endpoints).
 * Always returns a JSON-friendly object; HTTP/API failures are nested under errors.
 */
export const pageInfo = async (pageId) => {
  const out = { pageId: String(pageId), page: null, restrictions: null, errors: [] };

  const pageRes = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${pageId}`);
  if (!pageRes.ok) {
    out.errors.push({ step: 'page', status: pageRes.status, body: (await pageRes.text()).slice(0, 400) });
    return out;
  }
  const page = await pageRes.json();
  out.page = {
    id: page.id,
    title: page.title,
    status: page.status,
    authorId: page.authorId,
    spaceId: page.spaceId,
    version: page.version?.number,
    versionCreatedAt: page.version?.createdAt,
    versionAuthorId: page.version?.authorId,
  };

  // Probe v1 restriction endpoints (byOperation is the compact shape).
  const byOpRes = await api.asApp().requestConfluence(
    route`/wiki/rest/api/content/${pageId}/restriction/byOperation`
  );
  if (!byOpRes.ok) {
    out.errors.push({
      step: 'restriction/byOperation',
      status: byOpRes.status,
      body: (await byOpRes.text()).slice(0, 400),
    });
  } else {
    const byOp = await byOpRes.json();
    out.restrictions = {
      read: summariseOp(byOp.read),
      update: summariseOp(byOp.update),
    };
  }

  // Also grab the flat list for completeness (errors recorded, non-fatal).
  const listRes = await api.asApp().requestConfluence(
    route`/wiki/rest/api/content/${pageId}/restriction?limit=50`
  );
  if (!listRes.ok) {
    out.errors.push({
      step: 'restriction',
      status: listRes.status,
      body: (await listRes.text()).slice(0, 400),
    });
  } else {
    const list = await listRes.json();
    out.restrictionList = (list.results || []).map(summariseOp);
  }

  return out;
};

/**
 * Clear blocking edit restrictions so space writers can edit the page.
 * Tries DELETE (all restrictions), then PUT with empty update lists if needed.
 * Errors are returned in the JSON response (never thrown for probe failures).
 */
export const makeEditable = async (pageId) => {
  const before = await pageInfo(pageId);
  const attempts = [];

  // 1) DELETE all restrictions (read + update).
  const delRes = await api.asApp().requestConfluence(
    route`/wiki/rest/api/content/${pageId}/restriction`,
    { method: 'DELETE', headers: { Accept: 'application/json' } }
  );
  const delBody = (await delRes.text()).slice(0, 600);
  attempts.push({ method: 'DELETE', path: '/restriction', status: delRes.status, body: delBody });

  // 2) If DELETE failed, try PUT clearing the update (edit) list explicitly.
  if (!delRes.ok) {
    const putBody = {
      results: [
        { operation: 'update', restrictions: { user: { results: [] }, group: { results: [] } } },
        { operation: 'read', restrictions: { user: { results: [] }, group: { results: [] } } },
      ],
    };
    const putRes = await api.asApp().requestConfluence(
      route`/wiki/rest/api/content/${pageId}/restriction`,
      {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      }
    );
    attempts.push({
      method: 'PUT',
      path: '/restriction',
      status: putRes.status,
      body: (await putRes.text()).slice(0, 600),
    });
  }

  const after = await pageInfo(pageId);
  return {
    pageId: String(pageId),
    before: { page: before.page, restrictions: before.restrictions, errors: before.errors },
    attempts,
    after: { page: after.page, restrictions: after.restrictions, errors: after.errors },
    cleared: attempts.some((a) => a.status >= 200 && a.status < 300),
  };
};

/**
 * Append a one-line ADF claim paragraph to a page as the current user
 * (so Teamwork Graph gets a real human contributor). Uses the current version.
 */
export const claimPageAsUser = async (pageId, displayName) => {
  const getRes = await api.asUser().requestConfluence(
    route`/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`
  );
  if (!getRes.ok) {
    return { ok: false, error: `fetch page HTTP ${getRes.status}: ${(await getRes.text()).slice(0, 300)}` };
  }
  const page = await getRes.json();
  const raw = page.body?.atlas_doc_format?.value;
  let adf;
  try {
    adf = raw ? JSON.parse(raw) : { type: 'doc', version: 1, content: [] };
  } catch (e) {
    return { ok: false, error: `ADF parse failed: ${e.message}` };
  }
  if (!Array.isArray(adf.content)) adf.content = [];

  const date = new Date().toISOString().slice(0, 10);
  const note = `Demo page claimed for TWG by ${displayName || 'a teammate'} on ${date}.`;
  adf.content.push({
    type: 'paragraph',
    content: [{ type: 'text', text: note }],
  });

  const nextVersion = (page.version?.number || 1) + 1;
  const putRes = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: String(pageId),
      status: page.status || 'current',
      title: page.title,
      body: { representation: 'atlas_doc_format', value: JSON.stringify(adf) },
      version: { number: nextVersion, message: 'Claimed demo page for Teamwork Graph (human contributor)' },
    }),
  });
  if (!putRes.ok) {
    return { ok: false, error: `update page HTTP ${putRes.status}: ${(await putRes.text()).slice(0, 400)}` };
  }
  const updated = await putRes.json();
  return {
    ok: true,
    pageId: String(pageId),
    title: updated.title,
    version: updated.version?.number,
    note,
    authorId: updated.authorId,
    versionAuthorId: updated.version?.authorId,
  };
};
