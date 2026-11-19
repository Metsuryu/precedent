/**
 * Jira issue panel: shows past decisions related to this issue and flags
 * possible contradictions, with who decided, when, and a link to the source.
 * Also offers a one-click "Claim demo page" when the seeded Confluence page exists,
 * so a human becomes a Teamwork Graph contributor without using the REST API.
 */
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box, Button, Em, Heading, Inline, Link, Lozenge, SectionMessage, Spinner, Stack, Strong, Text, EmptyState, xcss,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { decidedLine, panelSummary, statusBadge } from '../lib/ui.js';

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
  if (!w) return <Text size="small" color="color.text.subtle">Looking up who to ask…</Text>;
  const people = uniq([...names(w.owners), ...names([w.creator]), ...names(w.contributors)]).slice(0, 5);
  const teams = uniq([...(w.teams || []), ...(w.projectTeams || [])].map((t) => t.name).filter(Boolean)).slice(0, 4);
  const linked = (w.linkedPages || []).slice(0, 3);
  if (!people.length && !teams.length && !linked.length) {
    const why = w.errors?.length
      ? ' (Teamwork Graph unavailable right now)'
      : w.notes?.length
        ? ' (the decision page was written by an app, so Teamwork Graph has no page authors)'
        : ' (no extra Teamwork Graph data)';
    return <Text size="small" color="color.text.subtle">Who to ask: {w.recordedOwner || 'the recorded owner'}{why}</Text>;
  }
  return (
    <Stack space="space.050">
      {people.length > 0 && <Text>Who to ask: <Strong>{people.join(', ')}</Strong></Text>}
      {teams.length > 0 && <Text size="small">Teams: {teams.join(', ')}</Text>}
      {linked.length > 0 && (
        <Text size="small">
          Linked pages:{' '}
          {linked.map((p, i) => (
            <React.Fragment key={p.url || i}>{i > 0 ? ', ' : ''}<Link href={p.url} openNewTab>{p.title || 'page'}</Link></React.Fragment>
          ))}
        </Text>
      )}
    </Stack>
  );
};

const DecisionRow = ({ m, who, showWho }) => {
  const badge = statusBadge(m);
  return (
    <Box xcss={rowStyle}>
      <Stack space="space.075">
        <Inline space="space.100" alignBlock="center" shouldWrap>
          <Lozenge appearance="new">{m.id}</Lozenge>
          <Lozenge appearance={badge.appearance}>{badge.text}</Lozenge>
          {m.possibleContradiction && <Lozenge appearance="removed" isBold>Possible contradiction</Lozenge>}
        </Inline>
        <Text weight="bold">{m.title}</Text>
        <Text>{m.decision}</Text>
        <Text size="small" color="color.text.subtle">
          {decidedLine(m)}
          {m.source?.url ? ' · ' : ''}
          {m.source?.url && <Link href={m.source.url} openNewTab>{m.source.title || 'Source'}</Link>}
        </Text>
        {m.why?.length > 0 && <Text size="small" color="color.text.subtlest">Matched on: {m.why.join('; ')}</Text>}
        {showWho && <WhoToAsk w={who} />}
      </Stack>
    </Box>
  );
};

/** Demo-only Claim control: human edits the seeded Confluence page as themselves. */
const ClaimDemo = ({ claim, onClaimed }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (!claim?.available) return null;

  const run = () => {
    setBusy(true);
    setMsg(null);
    invoke('claimDemoPage')
      .then((res) => {
        setBusy(false);
        if (res?.ok) {
          setMsg({ ok: true, text: `Claimed as ${res.displayName} (v${res.version}). Reload the panel to refresh Teamwork Graph.` });
          onClaimed?.(res);
        } else {
          setMsg({ ok: false, text: res?.error || 'Claim failed' });
        }
      })
      .catch((e) => {
        setBusy(false);
        setMsg({ ok: false, text: e.message || String(e) });
      });
  };

  return (
    <Stack space="space.100">
      <SectionMessage appearance="information" title="Demo: claim the decision page">
        <Text>
          The seeded Confluence page was created by the app, so Teamwork Graph has no human authors.
          Claim it once (edits the page as you) to become a contributor.
          {claim.url ? <> Source: <Link href={claim.url} openNewTab>demo page</Link>.</> : null}
        </Text>
      </SectionMessage>
      <Inline space="space.100" alignBlock="center">
        <Button appearance="primary" onClick={run} isDisabled={busy}>
          {busy ? 'Claiming…' : claim.claimed ? 'Claim again' : 'Claim demo page'}
        </Button>
        {claim.claimed && !msg?.ok && (
          <Text><Em>Previously claimed by {claim.claimedBy || 'a teammate'}.</Em></Text>
        )}
      </Inline>
      {msg && (
        <SectionMessage appearance={msg.ok ? 'success' : 'error'} title={msg.ok ? 'Claimed' : 'Claim failed'}>
          <Text>{msg.text}</Text>
        </SectionMessage>
      )}
    </Stack>
  );
};

const App = () => {
  const [state, setState] = useState({ loading: true });
  const [who, setWho] = useState({});
  const [claim, setClaim] = useState(null);

  const load = (fresh = false) => {
    setState({ loading: true });
    setWho({});
    invoke('checkCurrentIssue', { fresh })
      .then((data) => setState({ loading: false, data }))
      .catch((e) => setState({ loading: false, error: e.message }));
  };
  useEffect(() => load(false), []);
  useEffect(() => {
    invoke('getDemoClaim')
      .then((res) => setClaim(res || { available: false }))
      .catch(() => setClaim({ available: false }));
  }, []);

  // After matches render, enrich the top decisions (contradictions first) via Teamwork Graph.
  const whoIds = (state.data?.matches || []).slice(0, 3).map((m) => m.id);
  useEffect(() => {
    if (!whoIds.length) return;
    invoke('whoToAsk', { ids: whoIds, projectId: state.data?.issue?.projectId })
      .then((res) => setWho(res || {}))
      .catch(() => setWho(Object.fromEntries(whoIds.map((id) => [id, { errors: ['request failed'] }]))));
  }, [whoIds.join(',')]);

  if (state.loading) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Spinner size="small" label="Checking past decisions" />
        <Text color="color.text.subtle">Checking past decisions…</Text>
      </Inline>
    );
  }
  if (state.error || state.data?.error) {
    return (
      <Stack space="space.100">
        <SectionMessage appearance="error" title="Couldn't check this issue">
          <Text>{state.error || state.data.error}</Text>
        </SectionMessage>
        <Inline><Button onClick={() => load(true)}>Try again</Button></Inline>
      </Stack>
    );
  }
  const { matches } = state.data;
  const summary = panelSummary(state.data);

  return (
    <Stack space="space.150">
      {summary.tone === 'warning' ? (
        <SectionMessage appearance="warning" title={summary.title}>
          <Text>{summary.text}</Text>
        </SectionMessage>
      ) : summary.tone === 'info' ? (
        <Stack space="space.025">
          <Heading size="xsmall">{summary.title}</Heading>
          <Text size="small" color="color.text.subtle">{summary.text}</Text>
        </Stack>
      ) : (
        <EmptyState header={summary.title} description={summary.text} />
      )}
      {matches.map((m) => <DecisionRow key={m.id} m={m} who={who[m.id]} showWho={whoIds.includes(m.id)} />)}
      <Inline><Button appearance="subtle" spacing="compact" onClick={() => load(true)}>Re-check</Button></Inline>
      <ClaimDemo
        claim={claim}
        onClaimed={(res) => setClaim((c) => ({
          ...(c || {}),
          available: true,
          claimed: true,
          claimedBy: res.displayName,
          claimedAt: new Date().toISOString(),
          pageId: res.pageId,
        }))}
      />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
