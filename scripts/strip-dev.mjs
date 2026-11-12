// Prints manifest.yml with every "# >>> dev-only" ... "# <<< dev-only" block removed.
import { readFileSync } from 'node:fs';
export function stripDev(text) {
  const out = [];
  let skip = false;
  for (const line of text.split('\n')) {
    if (/#\s*>>>\s*dev-only/.test(line)) { if (skip) throw new Error('nested dev-only block'); skip = true; continue; }
    if (/#\s*<<<\s*dev-only/.test(line)) { if (!skip) throw new Error('unmatched dev-only end'); skip = false; continue; }
    if (!skip) out.push(line);
  }
  if (skip) throw new Error('unterminated dev-only block');
  return out.join('\n');
}
if (process.argv[1] && process.argv[1].endsWith('strip-dev.mjs')) {
  process.stdout.write(stripDev(readFileSync(process.argv[2] || 'manifest.yml', 'utf8')));
}
