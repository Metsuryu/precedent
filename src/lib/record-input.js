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
