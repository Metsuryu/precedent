# Precedent — decision memory for Jira

Teams keep re-arguing settled decisions, or quietly contradicting them. Precedent
remembers what your team already decided and warns you on the Jira issue where it matters.

- **Capture** decisions in Confluence with the **Decision record** macro
  (title, decision, rationale, owner, date, tags, components, "rules out" terms, status).
- **Surface** related decisions on every Jira issue in the **Precedent** issue panel, with
  **possible contradictions** flagged, plus who decided, when, and a link to the source page.
- **Ask** the **Precedent** Rovo agent: "Has this been decided before?", "Does this issue
  contradict anything?" It uses three reusable actions:
  `search-decisions`, `get-decision`, `check-issue`.

Runs entirely on Atlassian: Forge functions + Forge Custom Entity Store. No external AI
or third-party services; matching is deterministic (BM25-style keywords + tag/component
overlap + restriction phrases), and Rovo does the natural-language part.

## Architecture

```
src/
  lib/            pure logic, unit-tested (text, matcher, conflicts, ADF macro parsing)
  store/          decision repository (Forge Custom Entity Store via @forge/kvs)
  services/       use cases shared by every surface (checkIssue, search, detail),
                  Jira and Confluence API helpers
  resolvers/      UI Kit resolvers (macro sync, issue panel)
  actions/        Rovo action handlers
  triggers/       Confluence page created/updated → resync decision macros
  frontend/       UI Kit: macro.jsx (view + config), issue-panel.jsx
  devtools/       development-only web trigger (seed + backend checks)
  seed/           fictional demo data ("Lumen Freight")
```

New surfaces (MCP module, Teamwork Graph enrichment, global decision log page) plug into
`services/precedent.js` without touching the UI.

App compatibility: **Jira (required) + Confluence (optional)**, one installation with shared storage.

## Develop

Requires Node 24 and `@forge/cli`.

```
npm install
npm test                       # unit tests for the matcher
forge deploy -e development
forge install -p jira -s <site>.atlassian.net -e development
forge install -p confluence -s <site>.atlassian.net -e development
```

Dev-only seeding/verification (needs the `DEV_KEY`, `APP_UUID`, `ENV_UUID`, `ENV_NAME`
Forge variables in the development environment and a web trigger URL):
`scripts/dev.sh seed | status | check KEY-1 | search "text" | sync PAGEID`.

The dev web trigger must be removed from production builds (it also blocks
"Runs on Atlassian" eligibility).

## License

MIT — see [LICENSE](LICENSE).
