/**
 * Jira issue panel: shows past decisions related to this issue and flags
 * possible contradictions, with who decided, when, and a link to the source.
 */
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box, Button, Em, Inline, Link, Lozenge, SectionMessage, Spinner, Stack, Strong, Text, EmptyState, xcss,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const rowStyle = xcss({
  borderColor: 'color.border',
  borderStyle: 'solid',
  borderWidth: 'border.width',
  borderRadius: 'border.radius',
  padding: 'space.150',
});

const names = (people) => (people || []).map((p) => p?.name).filter(Boolean);
const uniq = (xs) => [...new Set(xs)];

/** Teamwork Graph "who decided / who to ask" block for one decision. */
const WhoToAsk = ({ w }) => {
  if (!w) return <Text><Em>Looking up who to ask…</Em></Text>;
  const people = uniq([...names(w.owners), ...names([w.creator]), ...names(w.contributors)]).slice(0, 5);
  const teams = uniq([...(w.teams || []), ...(w.projectTeams || [])].map((t) => t.name).filter(Boolean)).slice(0, 4);
  const linked = (w.linkedPages || []).slice(0, 3);
  if (!people.length && !teams.length && !linked.length) {
    return <Text><Em>Who to ask: {w.recordedOwner || 'the recorded owner'}{w.errors?.length ? ' (Teamwork Graph unavailable)' : ' (no extra Teamwork Graph data)'}</Em></Text>;
  }
  return (
    <Stack space="space.050">
      {people.length > 0 && <Text>Who to ask: <Strong>{people.join(', ')}</Strong></Text>}
      {teams.length > 0 && <Text>Teams: {teams.join(', ')}</Text>}
      {linked.length > 0 && (
        <Text>
          Linked pages:{' '}
          {linked.map((p, i) => (
            <React.Fragment key={p.url || i}>{i > 0 ? ', ' : ''}<Link href={p.url} openNewTab>{p.title || 'page'}</Link></React.Fragment>
          ))}
        </Text>
      )}
    </Stack>
  );
};

const DecisionRow = ({ m, who, showWho }) => (
  <Box xcss={rowStyle}>
    <Stack space="space.075">
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Lozenge appearance="new">{m.id}</Lozenge>
        {m.possibleContradiction && <Lozenge appearance="removed" isBold>Possible contradiction</Lozenge>}
        {m.status === 'superseded' && <Lozenge appearance="moved">Superseded{m.supersededBy ? ` by ${m.supersededBy}` : ''}</Lozenge>}
        <Strong>{m.title}</Strong>
      </Inline>
      <Text>{m.decision}</Text>
      <Text>
        Decided by <Strong>{m.owner || 'unknown'}</Strong>{m.decidedOn ? ` on ${m.decidedOn}` : ''}
        {m.source?.url ? ' · ' : ''}
        {m.source?.url && <Link href={m.source.url} openNewTab>{m.source.title || 'source'}</Link>}
      </Text>
      {m.why?.length > 0 && <Text><Em>Why it matched: {m.why.join('; ')}</Em></Text>}
      {showWho && <WhoToAsk w={who} />}
    </Stack>
  </Box>
);

const App = () => {
  const [state, setState] = useState({ loading: true });
  const [who, setWho] = useState({});

  const load = (fresh = false) => {
    setState({ loading: true });
    setWho({});
    invoke('checkCurrentIssue', { fresh })
      .then((data) => setState({ loading: false, data }))
      .catch((e) => setState({ loading: false, error: e.message }));
  };
  useEffect(() => load(false), []);

  // After matches render, enrich the top decisions (contradictions first) via Teamwork Graph.
  const whoIds = (state.data?.matches || []).slice(0, 3).map((m) => m.id);
  useEffect(() => {
    if (!whoIds.length) return;
    invoke('whoToAsk', { ids: whoIds, projectId: state.data?.issue?.projectId })
      .then((res) => setWho(res || {}))
      .catch(() => setWho(Object.fromEntries(whoIds.map((id) => [id, { errors: ['request failed'] }]))));
  }, [whoIds.join(',')]);

  if (state.loading) return <Spinner label="Checking past decisions" />;
  if (state.error || state.data?.error) {
    return <SectionMessage appearance="error" title="Precedent could not check this issue"><Text>{state.error || state.data.error}</Text></SectionMessage>;
  }
  const { matches, contradictions, totalDecisions } = state.data;

  return (
    <Stack space="space.150">
      {contradictions > 0 ? (
        <SectionMessage appearance="warning" title={`This issue may contradict ${contradictions} past decision${contradictions > 1 ? 's' : ''}`}>
          <Text>Check with the decision owner before going ahead, or record a new decision that supersedes it.</Text>
        </SectionMessage>
      ) : matches.length > 0 ? (
        <Text>Related past decisions ({matches.length} of {totalDecisions}):</Text>
      ) : (
        <EmptyState header="No related decisions" description={`Checked ${totalDecisions} recorded decision${totalDecisions === 1 ? '' : 's'}.`} />
      )}
      {matches.map((m) => <DecisionRow key={m.id} m={m} who={who[m.id]} showWho={whoIds.includes(m.id)} />)}
      <Inline><Button appearance="subtle" onClick={() => load(true)}>Re-check</Button></Inline>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
