/**
 * Product trigger: whenever a Confluence page is created or updated, re-read its
 * ADF and sync every "Decision record" macro into storage. This keeps the decision
 * log correct even if nobody views the page afterwards.
 */
import { syncPage, extractDecisionMacros } from '../services/confluence.js';

export const onPageEvent = async (event) => {
  const pageId = event?.content?.id;
  if (!pageId) return;
  try {
    const result = await syncPage(pageId);
    if (result.refs.length || result.removed.length) console.log(`page ${pageId}: synced ${result.refs.join(',')} removed ${result.removed.join(',')}`);
  } catch (e) {
    console.error(`page ${pageId}: sync failed`, e.message);
  }
};

export { extractDecisionMacros };
