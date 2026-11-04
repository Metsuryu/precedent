/**
 * Confluence "Decision record" macro (UI Kit).
 * - Config panel: authors fill in the decision fields in the editor.
 * - View: renders a decision card and saves the record to Forge storage.
 */
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box, Heading, Inline, Lozenge, Stack, Strong, Tag, TagGroup, Text, Textfield, TextArea, Select, DatePicker,
  SectionMessage, useConfig, useProductContext, xcss,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Superseded', value: 'superseded' },
];

/** Fields shown in the macro's configuration side panel. Values are stored by `name`. */
const Config = () => (
  <>
    <Textfield name="title" label="Decision title" isRequired />
    <TextArea name="decision" label="Decision (what was decided)" isRequired />
    <TextArea name="rationale" label="Rationale (why)" />
    <Textfield name="owner" label="Decided by (person or team)" />
    <DatePicker name="decidedOn" label="Decided on" />
    <Textfield name="tags" label="Tags (comma separated)" />
    <Textfield name="components" label="Components (comma separated)" />
    <Textfield name="conflictTerms" label="Rules out (comma separated terms an issue should not propose)" />
    <Select name="status" label="Status" options={STATUS_OPTIONS} />
    <Textfield name="supersededBy" label="Superseded by (e.g. DEC-12)" />
  </>
);

const cardStyle = xcss({
  borderColor: 'color.border',
  borderStyle: 'solid',
  borderWidth: 'border.width',
  borderRadius: 'border.radius',
  padding: 'space.200',
});

// Select values can come back as an option object or a plain string.
const statusValue = (s) => (typeof s === 'object' && s ? s.value : s) || 'active';
const list = (v) => String(v || '').split(',').map((t) => t.trim()).filter(Boolean);

const App = () => {
  const config = useConfig();
  const context = useProductContext();
  const [sync, setSync] = useState(null);

  const status = statusValue(config?.status);

  useEffect(() => {
    if (!config?.title || !context) return;
    invoke('syncDecisionMacro', { config: { ...config, status } }).then(setSync).catch((e) => setSync({ saved: false, reason: e.message }));
  }, [JSON.stringify(config), context?.localId]);

  if (!config?.title) {
    return (
      <SectionMessage title="Decision record" appearance="information">
        <Text>Edit this macro and fill in the decision title, what was decided, who decided it and when. Precedent will surface it on related Jira issues.</Text>
      </SectionMessage>
    );
  }

  return (
    <Box xcss={cardStyle}>
      <Stack space="space.100">
        <Inline space="space.100" alignBlock="center">
          {sync?.ref && <Lozenge appearance="new">{sync.ref}</Lozenge>}
          <Lozenge appearance={status === 'active' ? 'success' : 'moved'}>{status}</Lozenge>
          <Heading size="small">{config.title}</Heading>
        </Inline>
        <Text>{config.decision}</Text>
        {config.rationale && <Text><Strong>Why: </Strong>{config.rationale}</Text>}
        <Text>
          <Strong>Decided by </Strong>{config.owner || 'unknown'}{config.decidedOn ? ` on ${config.decidedOn}` : ''}
          {status === 'superseded' && config.supersededBy ? ` · superseded by ${config.supersededBy}` : ''}
        </Text>
        {(list(config.tags).length > 0 || list(config.components).length > 0) && (
          <TagGroup>
            {[...list(config.tags), ...list(config.components)].map((t) => <Tag key={t} text={t} />)}
          </TagGroup>
        )}
        {sync && !sync.saved && sync.reason !== 'editing' && <Text>Not saved to the decision log yet ({sync.reason}).</Text>}
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
ForgeReconciler.addConfig(<Config />);
