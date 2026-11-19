/**
 * Jira global page "Decision log": every recorded decision in one table,
 * with keyword search and status/tag filters. Data comes from the getDecisionLog resolver.
 */
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box, Button, DynamicTable, EmptyState, Form, FormFooter, FormSection, Heading, Inline, Label, Link, Lozenge,
  Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition, SectionMessage, Select, Spinner,
  Stack, Text, TextArea, Textfield, useForm, xcss,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { countsLine, statusBadge } from '../lib/ui.js';

const STATUS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Superseded', value: 'superseded' },
];
const pageStyle = xcss({ padding: 'space.300' });
const asText = (v) => (Array.isArray(v) ? v.join(', ') : v || '');

const head = {
  cells: [
    { key: 'id', content: 'ID', width: 8 },
    { key: 'title', content: 'Decision', width: 42 },
    { key: 'owner', content: 'Owner', width: 14 },
    { key: 'date', content: 'Decided', width: 10 },
    { key: 'status', content: 'Status', width: 14 },
    { key: 'source', content: 'Source', width: 12 },
  ],
};

const toRow = (d, onSupersede) => ({
  key: d.id,
  cells: [
    { key: 'id', content: <Lozenge appearance="new">{d.id}</Lozenge> },
    {
      key: 'title',
      content: (
        <Stack space="space.025">
          <Text weight="bold">{d.title}</Text>
          <Text>{d.decision}</Text>
          {asText(d.tags) && <Text size="small" color="color.text.subtlest">{asText(d.tags)}</Text>}
        </Stack>
      ),
    },
    { key: 'owner', content: d.owner || <Text color="color.text.subtlest">Unknown</Text> },
    { key: 'date', content: d.decidedOn || '' },
    {
      key: 'status',
      content: (
        <Stack space="space.050">
          <Lozenge appearance={statusBadge(d).appearance}>{statusBadge(d).text}</Lozenge>
          {d.status !== 'superseded' && (
            <Button appearance="subtle" spacing="compact" onClick={() => onSupersede(d)}>Supersede</Button>
          )}
        </Stack>
      ),
    },
    { key: 'source', content: d.source?.url ? <Link href={d.source.url} openNewTab>{d.source.title || 'Open'}</Link> : '' },
  ],
});

const FIELDS = [
  { name: 'title', label: 'Title', required: true, placeholder: 'e.g. Use Postgres for the orders service' },
  { name: 'decision', label: 'Decision', required: true, area: true, placeholder: 'What was decided, in one or two sentences' },
  { name: 'rationale', label: 'Rationale', area: true, placeholder: 'Why (optional)' },
  { name: 'owner', label: 'Owner', placeholder: 'Defaults to you' },
  { name: 'tags', label: 'Tags', placeholder: 'Comma separated, e.g. backend, datastore' },
  { name: 'issueKey', label: 'Jira issue', placeholder: 'Optional, e.g. MOBL-58' },
];

/** Modal form for recording a decision, or superseding `target` when given. */
const DecisionForm = ({ target, onClose, onSaved }) => {
  const { handleSubmit, register, getFieldId } = useForm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (form) => {
    setSaving(true);
    setError(null);
    try {
      const res = target
        ? await invoke('supersedeFromLog', { form: { ...form, decisionId: target.id } })
        : await invoke('recordFromLog', { form });
      if (res?.error) setError(res.error);
      else onSaved(res);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <Form onSubmit={handleSubmit(submit)}>
        <ModalHeader>
          <ModalTitle>{target ? `Supersede ${target.id}` : 'Record a decision'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <FormSection>
            {target && (
              <SectionMessage appearance="information">
                <Text>Replaces {target.id}: {target.title}. {target.id} will be marked superseded.</Text>
              </SectionMessage>
            )}
            {FIELDS.map((f) => (
              <Box key={f.name}>
                <Label labelFor={getFieldId(f.name)}>{f.label}{f.required ? ' *' : ''}</Label>
                {f.area ? (
                  <TextArea {...register(f.name, { required: f.required })} placeholder={f.placeholder} />
                ) : (
                  <Textfield {...register(f.name, { required: f.required })} placeholder={f.placeholder} />
                )}
              </Box>
            ))}
            {error && <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>}
          </FormSection>
        </ModalBody>
        <ModalFooter>
          <FormFooter>
            <Button appearance="subtle" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" type="submit" isDisabled={saving}>{saving ? 'Saving…' : target ? 'Supersede' : 'Record'}</Button>
          </FormFooter>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

const App = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(STATUS[0]);
  const [tag, setTag] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState(null);
  const openForm = (d = null) => { setTarget(d); setNotice(null); setFormOpen(true); };
  const onSaved = (res) => {
    setFormOpen(false);
    setNotice(res.supersedes ? `Recorded ${res.id}; ${res.supersedes} is now superseded.` : `Recorded ${res.id}.`);
    load();
  };

  const [seeding, setSeeding] = useState(false);
  const loadSamples = async () => {
    setSeeding(true);
    setNotice(null);
    try {
      const res = await invoke('loadSampleDecisions');
      if (res?.error) setError(res.error);
      else setNotice(`Loaded ${res.loaded} sample decisions.`);
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSeeding(false);
    }
  };

  const load = async (q = query, s = status, t = tag) => {
    setLoading(true);
    setError(null);
    try {
      setData(await invoke('getDecisionLog', { query: q, status: s?.value || 'all', tag: t?.value || '' }));
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tagOptions = [{ label: 'All tags', value: '' }, ...(data?.tags || []).map((t) => ({ label: t, value: t }))];
  const filtered = Boolean(query.trim() || status.value !== 'all' || tag?.value);

  return (
    <Box xcss={pageStyle}>
      <Stack space="space.200">
        <Inline spread="space-between" alignBlock="center">
          <Stack space="space.050">
            <Heading size="large">Decision log</Heading>
            <Text color="color.text.subtle">
              Decisions recorded from Confluence, Rovo and Jira.
              {data?.counts ? ` ${countsLine(data.counts)}.` : ''}
            </Text>
          </Stack>
          <Button appearance="primary" onClick={() => openForm()}>Record decision</Button>
        </Inline>
        {notice && <SectionMessage appearance="success"><Text>{notice}</Text></SectionMessage>}
        <Inline space="space.100" alignBlock="end" shouldWrap>
          <Box xcss={xcss({ width: '320px' })}>
            <Textfield
              placeholder="Search decisions, e.g. datastore, API v1, DEC-3"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Box>
          <Box xcss={xcss({ width: '180px' })}>
            <Select options={STATUS} value={status} onChange={(v) => { setStatus(v); load(query, v, tag); }} />
          </Box>
          <Box xcss={xcss({ width: '180px' })}>
            <Select options={tagOptions} value={tag || tagOptions[0]} onChange={(v) => { setTag(v); load(query, status, v); }} />
          </Box>
          <Button appearance="primary" onClick={() => load()}>Search</Button>
          {filtered && (
            <Button
              appearance="subtle"
              onClick={() => { setQuery(''); setStatus(STATUS[0]); setTag(null); load('', STATUS[0], null); }}
            >
              Clear
            </Button>
          )}
        </Inline>
        {error && (
          <SectionMessage appearance="error" title="Couldn't load decisions">
            <Stack space="space.100">
              <Text>{error}</Text>
              <Inline><Button onClick={() => load()}>Try again</Button></Inline>
            </Stack>
          </SectionMessage>
        )}
        {!data && !error && (
          <Inline space="space.100" alignBlock="center">
            <Spinner size="small" label="Loading decisions" />
            <Text color="color.text.subtle">Loading decisions…</Text>
          </Inline>
        )}
        {data && data.decisions.length === 0 && (
          <EmptyState
            header={filtered ? 'No decisions match' : 'No decisions recorded yet'}
            description={
              filtered
                ? 'Try fewer keywords or clear the filters.'
                : 'Record one here, add a "Decision record" macro to a Confluence page, or ask the Precedent Rovo agent.'
            }
          />
        )}
        {data && !filtered && data.counts?.total === 0 && (
          <Inline space="space.100" alignBlock="center">
            <Button appearance="primary" isDisabled={seeding} onClick={loadSamples}>{seeding ? 'Loading…' : 'Load sample decisions'}</Button>
            <Text size="small" color="color.text.subtle">Adds fictional "Lumen Freight" decisions so you can try search, conflict checks and Rovo.</Text>
          </Inline>
        )}
        {data && data.decisions.length > 0 && (
          <DynamicTable head={head} rows={data.decisions.map((d) => toRow(d, openForm))} isLoading={loading} rowsPerPage={20} />
        )}
        {data?.truncated && <Text size="small" color="color.text.subtle">Showing the first 100 matches. Narrow the search to see more.</Text>}
      </Stack>
      <ModalTransition>
        {formOpen && <DecisionForm target={target} onClose={() => setFormOpen(false)} onSaved={onSaved} />}
      </ModalTransition>
    </Box>
  );
};

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
