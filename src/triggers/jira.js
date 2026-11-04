/**
 * Product trigger: when an issue is created or edited, precompute its matches so the
 * issue panel can render from cache instead of computing on first view.
 */
import { precomputeIssue } from '../services/precedent.js';

export const onIssueEvent = async (event) => {
  const id = event?.issue?.id || event?.issue?.key;
  if (!id) return;
  try {
    const r = await precomputeIssue(id);
    console.log(`issue ${r.issue.key}: precomputed ${r.matches.length} matches, ${r.contradictions} contradictions`);
  } catch (e) {
    console.error(`issue ${id}: precompute failed`, e.message);
  }
};
