# Precedent — decision memory for Jira

Teams keep re-arguing settled decisions, or quietly contradicting them. Precedent
remembers what your team already decided and warns you on the Jira issue where it matters.

- **Capture** decisions in Confluence with the **Decision record** macro
  (title, decision, rationale, owner, date, tags, components, "rules out" terms, status).
- **Surface** related decisions on every Jira issue in the **Precedent** issue panel, with
  **possible contradictions** flagged, plus who decided, when, and a link to the source page.
- **Ask** the **Precedent** Rovo agent: "Has this been decided before?", "Does this issue
  contradict anything?" "Who should I ask?" It uses four reusable actions:
  `search-decisions`, `get-decision`, `check-issue`, `who-to-ask`.
- **Who to ask**: Atlassian **Teamwork Graph** (Preview, curated queries, as the viewing user)
  adds the decision page's owners, creator, contributors, their teams, teams linked to the
  issue's project, and linked pages.
- **MCP + skill**: the same tools are exposed through a `rovo:mcp` server
  (`precedent-mcp`) for Rovo Studio agents and admin-approved external MCP clients, and the
  review procedure ships as an open Agent Skill: [`skills/decision-check/SKILL.md`](skills/decision-check/SKILL.md)
  (also the `rovo:skill` module `decision-check`).

Runs entirely on Atlassian: Forge functions + Forge Custom Entity Store. No external AI
or third-party services; matching is deterministic (BM25-style keywords + tag/component
overlap + restriction phrases), and Rovo does the natural-language part.

## Architecture

```
src/
  lib/            pure logic, unit-tested (text, matcher, conflicts, ADF macro parsing)
  store/          decision repository (Forge Custom Entity Store via @forge/kvs)
  services/       use cases shared by every surface (checkIssue + per-issue cache, search,
                  detail, whoToAsk), Jira / Confluence / Teamwork Graph helpers
  resolvers/      UI Kit resolvers (macro sync, issue panel)
  actions/        Rovo action handlers
  triggers/       Confluence page created/updated → resync decision macros;
                  Jira issue created/updated → precompute panel matches
skills/           open Agent Skill (decision-check) used by the rovo:skill module
  frontend/       UI Kit: macro.jsx (view + config), issue-panel.jsx
  devtools/       development-only web trigger (seed + backend checks)
  seed/           fictional demo data ("Lumen Freight")
```

Every surface (panel, Rovo actions, MCP tools) goes through `services/precedent.js`.

Panel speed: a decision-log version counter is bumped on every real change; per-issue
match results are cached against that version (written by the Jira issue trigger and by
live checks), and the decision list is memoised in warm containers. Macro views no longer
rewrite unchanged decisions.

App compatibility: **Jira (required) + Confluence (optional)**, one installation with shared storage.

## Develop

Requires Node 24 and `@forge/cli`.

```
npm install
npm test                       # unit tests (matcher, Teamwork Graph query builders)
node scripts/validate-twg.mjs <site>.atlassian.net   # validate TWG queries against the site's public schema
forge deploy -e development
forge install -p jira -s <site>.atlassian.net -e development
forge install -p confluence -s <site>.atlassian.net -e development
```

Dev-only seeding/verification (needs the `DEV_KEY`, `APP_UUID`, `ENV_UUID`, `ENV_NAME`
Forge variables in the development environment and a web trigger URL):
`scripts/dev.sh seed | status | check KEY-1 | precompute KEY-1 | search "text" | sync PAGEID | twg-app`.

The dev web trigger must be removed from production builds (it also blocks
"Runs on Atlassian" eligibility).

## Demo

Video script and storyboard: [docs/DEMO.md](docs/DEMO.md).

## License

MIT — see [LICENSE](LICENSE).
