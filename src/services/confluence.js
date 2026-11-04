/**
 * Confluence helpers: read a page's ADF and extract our "Decision record" macros,
 * so decisions can be (re)synced server-side from page events — no page view needed.
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
