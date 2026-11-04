/**
 * Decision repository backed by the Forge Custom Entity Store (@forge/kvs).
 * Data stays in Atlassian-hosted storage (Runs on Atlassian).
 *
 * Entity "decision" (see manifest.yml → app.storage.entities):
 *   ref          human id, e.g. "DEC-7"
 *   title, decision, rationale, owner, decidedOn (YYYY-MM-DD)
 *   tags[], components[], conflictTerms (comma separated)
 *   status       "active" | "superseded"
 *   sourceType   "confluence" | "seed"
 *   sourceKey    stable id of the origin (e.g. "<pageId>:<macroLocalId>")
 *   sourceUrl, sourceTitle, recordedBy (accountId), updatedAt (epoch seconds)
 */
import { kvs, WhereConditions } from '@forge/kvs';
import { toList } from '../lib/text.js';

const ENTITY = 'decision';
const SEQ_KEY = 'seq:decision';
const VERSION_KEY = 'meta:decisions-version';
const entity = () => kvs.entity(ENTITY);

/**
 * Monotonic "decision log version". Bumped on every real change so caches
 * (per-issue match results, the in-memory list) know when they are stale.
 */
export const getVersion = async () => (await kvs.get(VERSION_KEY)) || 0;
export const bumpVersion = async () => {
  const v = (await getVersion()) + 1;
  await kvs.set(VERSION_KEY, v);
  memo = undefined;
  return v;
};
let memo; // { version, decisions } — survives across invocations in a warm container

const CONTENT_FIELDS = ['title', 'decision', 'rationale', 'owner', 'decidedOn', 'tags', 'components', 'conflictTerms', 'status', 'supersededBy', 'sourceTitle', 'sourceUrl'];
const sameContent = (a, b) => CONTENT_FIELDS.every((f) => JSON.stringify(a?.[f] ?? '') === JSON.stringify(b?.[f] ?? ''));

/** Entity keys must be simple strings; derive one from the source key. */
export const keyForSource = (sourceKey) => `d:${String(sourceKey).replace(/[^a-zA-Z0-9:._-]/gu, '_')}`.slice(0, 100);

const nextRef = async () => {
  const n = ((await kvs.get(SEQ_KEY)) || 0) + 1;
  await kvs.set(SEQ_KEY, n);
  return `DEC-${n}`;
};

/** Normalise user input into a storable record. */
export const normalizeDecision = (input) => ({
  title: String(input.title || '').trim().slice(0, 200),
  decision: String(input.decision || '').trim().slice(0, 4000),
  rationale: String(input.rationale || '').trim().slice(0, 4000),
  owner: String(input.owner || '').trim().slice(0, 200),
  decidedOn: String(input.decidedOn || '').slice(0, 10),
  tags: toList(input.tags),
  components: toList(input.components),
  conflictTerms: toList(input.conflictTerms).join(', '),
  status: input.status === 'superseded' ? 'superseded' : 'active',
  supersededBy: String(input.supersededBy || '').trim().slice(0, 40),
});

/**
 * Create or update the decision that comes from a given source (idempotent).
 * Keeps the existing DEC-n reference when the record already exists.
 */
export const upsertFromSource = async ({ sourceKey, sourceType, sourceUrl, sourceTitle, recordedBy }, input) => {
  const key = keyForSource(sourceKey);
  const existing = await entity().get(key);
  const record = {
    ...normalizeDecision(input),
    ref: existing?.ref || (await nextRef()),
    sourceKey: String(sourceKey),
    sourceType: sourceType || 'confluence',
    sourceUrl: sourceUrl || existing?.sourceUrl || '',
    sourceTitle: sourceTitle || existing?.sourceTitle || '',
    recordedBy: recordedBy || existing?.recordedBy || '',
    updatedAt: Math.floor(Date.now() / 1000), // epoch seconds (entity integers are 32-bit)
  };
  // The entity store rejects empty strings, so drop blank optional attributes.
  for (const k of Object.keys(record)) if (record[k] === '') delete record[k];
  // The macro re-syncs on every view: skip the write (and cache invalidation) when nothing changed.
  if (existing && sameContent(existing, record)) return { key, ...existing, unchanged: true };
  await entity().set(key, record);
  await bumpVersion();
  return { key, ...record };
};

/** Read every decision (paged). Fine for v1 volumes (hundreds). */
const readAll = async () => {
  const out = [];
  let cursor;
  do {
    let q = entity().query().index('by-updated').where(WhereConditions.greaterThan(0)).limit(100);
    if (cursor) q = q.cursor(cursor);
    const page = await q.getMany();
    for (const r of page.results) out.push({ key: r.key, ...r.value });
    cursor = page.nextCursor;
  } while (cursor);
  return out;
};

/** All decisions, served from a warm-container memo while the log version is unchanged. */
export const listDecisions = async ({ includeSuperseded = true, version } = {}) => {
  const v = version ?? (await getVersion());
  if (!memo || memo.version !== v) memo = { version: v, decisions: await readAll() };
  const out = memo.decisions;
  return includeSuperseded ? out : out.filter((d) => d.status === 'active');
};

/** Look up by "DEC-7" (case-insensitive) or by internal key. */
export const getDecision = async (idOrRef) => {
  const id = String(idOrRef || '').trim();
  if (!id) return undefined;
  if (id.startsWith('d:')) {
    const v = await entity().get(id);
    return v ? { key: id, ...v } : undefined;
  }
  const hit = await entity().query().index('by-ref').where(WhereConditions.equalTo(id.toUpperCase())).getOne();
  return hit ? { key: hit.key, ...hit.value } : undefined;
};

/** Remove decisions from a page whose macros were deleted. */
export const deleteMissingForPage = async (pageId, keepSourceKeys) => {
  const keep = new Set(keepSourceKeys);
  const all = await listDecisions();
  const stale = all.filter((d) => d.sourceType === 'confluence' && d.sourceKey.startsWith(`${pageId}:`) && !keep.has(d.sourceKey));
  for (const d of stale) await entity().delete(d.key);
  if (stale.length) await bumpVersion();
  return stale.map((d) => d.ref);
};
