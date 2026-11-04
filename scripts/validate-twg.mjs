// Validates our Teamwork Graph queries against the site's public TWG schema (SDL).
// Usage: node scripts/validate-twg.mjs <site>.atlassian.net
import { buildSchema, parse, validate } from 'graphql';
import { PAGE_PEOPLE_QUERY, teamsQuery } from '../src/services/teamwork-graph.js';

const site = process.argv[2] || 'one-atlas-uyme.atlassian.net';
const sdl = await (await fetch(`https://${site}/gateway/api/graphql/twg/schema`)).text();
const schema = buildSchema(sdl, { assumeValidSDL: true });
let bad = 0;
for (const [name, q] of [['pagePeople', PAGE_PEOPLE_QUERY], ['teams(3,project)', teamsQuery(3, true)], ['teams(1)', teamsQuery(1, false)]]) {
  const errs = validate(schema, parse(q));
  console.log(name, errs.length ? errs.map((e) => e.message) : 'OK');
  bad += errs.length;
}
process.exit(bad ? 1 : 0);
