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

const DecisionRow = ({ m }) => (
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
    </Stack>
  </Box>
);

const App = () => {
  const [state, setState] = useState({ loading: true });

  const load = () => {
    setState({ loading: true });
    invoke('checkCurrentIssue')
      .then((data) => setState({ loading: false, data }))
      .catch((e) => setState({ loading: false, error: e.message }));
  };
  useEffect(load, []);

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
      {matches.map((m) => <DecisionRow key={m.id} m={m} />)}
      <Inline><Button appearance="subtle" onClick={load}>Re-check</Button></Inline>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
