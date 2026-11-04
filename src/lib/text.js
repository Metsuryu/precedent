/**
 * Small, dependency-free text helpers used by the matcher.
 * Everything runs inside Forge (Runs on Atlassian): no external AI or NLP services.
 */

// Common English words that carry no topical meaning for matching.
const STOPWORDS = new Set(
  (
    'a an and are as at be been but by can could did do does for from had has have how i if in into is it its ' +
    'let may me more must my of on or our out over shall should so some such than that the their them then there ' +
    'these they this those to too up us was we were what when where which while who why will with would you your ' +
    'all any also add adding new use using used via per each every just only very please need needs want wants ' +
    'make makes made get gets set sets team teams issue issues ticket task story bug ' +
    'update updates change changes year years minute minutes day days time one two first last end next now'
  ).split(/\s+/)
);

/** Very light stemmer: good enough to match "caches"/"caching"/"cache". */
export const stem = (word) => {
  if (word.length <= 3 || /^[0-9]/u.test(word)) return word;
  let w = word.replace(/(ing|ed)$/u, '').replace(/s$/u, '');
  if (w.length > 3) w = w.replace(/e$/u, '');
  return w.replace(/(.)\1$/u, '$1'); // "plann" -> "plan"
};

/** Lowercase, split on non-alphanumerics, drop stopwords, stem. */
export const tokenize = (text) => {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
};

/** Normalised phrase for substring checks ("API v1" -> "api v1"). */
export const normalizePhrase = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();

/** Split "a, b; c" (or an array) into a clean, de-duplicated list of lowercase tags. */
export const toList = (value) => {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,;\n]/u);
  return [...new Set(raw.map((t) => normalizePhrase(t)).filter(Boolean))];
};

/** Flatten Atlassian Document Format (ADF) into plain text. Accepts strings too. */
export const adfToText = (node) => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join(' ');
  let out = node.text || '';
  if (node.content) out += ' ' + adfToText(node.content);
  return out.replace(/\s+/gu, ' ').trim();
};
