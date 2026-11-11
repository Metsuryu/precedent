/**
 * Pure helpers for record-decision / supersede-decision inputs.
 * Kept dependency-free so unit tests can cover them without Forge runtime.
 */

/** YYYY-MM-DD in UTC for the given Date (defaults to now). */
export const todayUTC = (d = new Date()) => d.toISOString().slice(0, 10);

/** Required fields for recording a new decision. Returns an error string or null. */
export const validateRecordFields = ({ title, decision } = {}) => {
  if (!String(title || '').trim()) return 'Provide a title for the decision.';
  if (!String(decision || '').trim()) return 'Provide the decision text.';
  return null;
};

/** Required fields for superseding: old id + new title/decision. */
export const validateSupersedeFields = ({ decisionId, title, decision } = {}) => {
  if (!String(decisionId || '').trim()) return 'Provide the decision id to supersede, e.g. DEC-3.';
  return validateRecordFields({ title, decision });
};

/**
 * Build entity source metadata for an action-recorded decision.
 * Prefer linking to a Jira issue when issueKey is present.
 */
export const buildSourceMeta = ({ issueKey, accountId, unique } = {}) => {
  const key = String(issueKey || '')
    .trim()
    .toUpperCase();
  const uid = String(unique || Date.now());
  if (key) {
    return {
      sourceType: 'jira',
      sourceKey: `jira:${key}:${uid}`,
      sourceUrl: `/browse/${key}`,
      sourceTitle: key,
      recordedBy: accountId || '',
    };
  }
  return {
    sourceType: 'action',
    sourceKey: `action:${uid}`,
    recordedBy: accountId || '',
  };
};

const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

/**
 * Turn the Decision log page's record/supersede form into service input.
 * Trims and caps every field, uppercases + validates the optional issue key,
 * and returns { input } or { error } (never throws).
 */
export const formToInput = (form = {}, { supersede = false } = {}) => {
  const cap = (v, n) => String(v ?? '').trim().slice(0, n);
  const input = {
    title: cap(form.title, 200),
    decision: cap(form.decision, 2000),
    rationale: cap(form.rationale, 4000),
    owner: cap(form.owner, 120),
    decidedOn: cap(form.decidedOn, 10),
    tags: cap(form.tags, 300),
    issueKey: cap(form.issueKey, 40).toUpperCase(),
  };
  if (supersede) input.decisionId = cap(form.decisionId, 20).toUpperCase();
  if (input.decidedOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.decidedOn)) return { error: 'Use YYYY-MM-DD for the decision date.' };
  if (input.issueKey && !ISSUE_KEY.test(input.issueKey)) return { error: `"${input.issueKey}" is not a Jira issue key, e.g. MOBL-58.` };
  const err = supersede ? validateSupersedeFields(input) : validateRecordFields(input);
  if (err) return { error: err };
  for (const k of Object.keys(input)) if (input[k] === '') delete input[k];
  return { input };
};
