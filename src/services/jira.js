/** Jira REST helpers. `asUser` respects the viewer's permissions; `asApp` is used only by dev tooling. */
import api, { route } from '@forge/api';
import { adfToText } from '../lib/text.js';

const client = (mode) => (mode === 'app' ? api.asApp() : api.asUser());

/** Fetch an issue and reduce it to the fields the matcher needs. */
export const fetchIssue = async (issueIdOrKey, mode = 'user') => {
  const res = await client(mode).requestJira(
    route`/rest/api/3/issue/${issueIdOrKey}?fields=summary,description,labels,components,status,project`
  );
  if (!res.ok) throw new Error(`Jira issue ${issueIdOrKey}: HTTP ${res.status}`);
  const data = await res.json();
  const f = data.fields || {};
  return {
    id: data.id,
    key: data.key,
    summary: f.summary || '',
    description: adfToText(f.description),
    labels: f.labels || [],
    components: (f.components || []).map((c) => c.name),
    status: f.status?.name,
    project: f.project?.key,
    projectId: f.project?.id,
  };
};

/** Add an ADF comment to an issue as the current user (respects their permissions). */
export const addComment = async (issueIdOrKey, adf) => {
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${issueIdOrKey}/comment`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: adf }),
  });
  if (!res.ok) throw new Error(`Comment on ${issueIdOrKey}: HTTP ${res.status}`);
  const data = await res.json();
  return { id: data.id };
};
