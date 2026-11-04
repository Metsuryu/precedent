/** Pure helpers to find Precedent "Decision record" macros inside Confluence ADF. */

export const MACRO_MODULE_KEY = 'precedent-decision-record';

/** Walk ADF and return [{ localId, params }] for every instance of our macro. */
export const extractDecisionMacros = (adf) => {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if ((node.type === 'extension' || node.type === 'bodiedExtension' || node.type === 'inlineExtension') && node.attrs) {
      const key = String(node.attrs.extensionKey || '');
      if (key.endsWith(`/static/${MACRO_MODULE_KEY}`) || key === MACRO_MODULE_KEY) {
        const p = node.attrs.parameters || {};
        const localId = p.localId || node.attrs.localId;
        found.push({ localId, params: p.guestParams || {} });
      }
    }
    (node.content || []).forEach(walk);
  };
  walk(adf);
  return found;
};

