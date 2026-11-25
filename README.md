# Precedent — decision memory for Jira

Teams keep re-arguing settled decisions, or quietly contradicting them. Precedent
remembers what your team already decided and warns you on the Jira issue where it matters.

- **Capture** decisions in Confluence with the **Decision record** macro
  (title, decision, rationale, owner, date, tags, components, "rules out" terms, status).
- **Surface** related decisions on every Jira issue in the **Precedent** issue panel, with
  **possible contradictions** flagged, plus who decided, when, and a link to the source page.
- **Ask** the **Precedent** Rovo agent: "Has this been decided before?", "Does this issue
  contradict anything?" "Who should I ask?" It uses seven reusable actions:
  read-only `search-decisions`, `get-decision`, `check-issue`, `who-to-ask`, and (on
  request, after confirming) `record-decision`, `supersede-decision`, `post-decision-context`
  (posts a "Decision context" comment on the issue).
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

## Try it

1. Install from the link (Jira required, Confluence optional):
   <https://developer.atlassian.com/console/install/d493a6cd-d4e5-4281-94bf-0ba3be5e255a?signature=AYABeNDkcz2Xldb7dwhoMkT4FRAAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBMYrtYxtKds6S7irURgaajQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDInj%2Bh9sQzMh%2ByS%2BsQIBEIA7n2fwrhy%2BzRboDzg1wA0100Wr1YH0KjQXf4WTq5f26h%2B6oLQdxkIs4TuhPyWujtiZlzlC2%2FgrXvSiQOcAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgGiYSDwAG%2FO9H5C5YkC8FvaAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMQSG9n948Jj7BoSxIAgEQgDthwku%2FQX07MA9HXjEla958vUbFEz6R7uAhcUXbwgwKcJkq2den6qeKw6IQvgwlzlDEP3jyXPn%2BZubw6wAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAVg7nEk%2Bpsir%2BBEtLaVIlu4AAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxwDZTzxGSMHVZl5t8CARCAO9VMA643JnXMAutOU%2BDrz8Yy5gcfErXMoClA7m6lZLJfead%2BEEYUwDLKl8qA8TvhwkxPIEmOUQMPckt3AgAAAAAMAAAQAAAAAAAAAAAAAAAAALr2779VUxy%2FQLa1XuXWspn%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADJB4vwyZ3F0DxWL8ZNdVftNiwPiVgTek3mvjYXhw72U8DPLXUh%2BMAiIeGzlI%2Ba%2BVsx8A4c1EhZkqPV3AqDHqVaX3rU%3D&product=jira&product=confluence>
2. In Jira open **Apps → Decision log**. On an empty install click **Load sample decisions**
   (fictional "Lumen Freight" data), or record your own with **Record decision**.
3. Open any issue: the **Precedent** panel lists related decisions and flags possible
   contradictions. In Confluence, add the **Decision record** macro to capture new ones.
4. In Rovo chat pick the **Precedent** agent and ask "Does this issue contradict anything?"

## Architecture

```
src/
  lib/            pure logic, unit-tested (text, matcher, conflicts, ADF macro parsing)
  store/          decision repository (Forge Custom Entity Store via @forge/kvs)
  services/       use cases shared by every surface (checkIssue + per-issue cache, search,
                  detail, whoToAsk), Jira / Confluence / Teamwork Graph helpers
  resolvers/      UI Kit resolvers (macro sync, issue panel, decision log)
  actions/        Rovo action handlers
  triggers/       Confluence page created/updated → resync decision macros;
                  Jira issue created/updated → precompute panel matches
  frontend/       UI Kit: macro.jsx (view + config), issue-panel.jsx, decision-log.jsx
  devtools/       development-only web trigger (seed + backend checks)
  seed/           fictional demo data ("Lumen Freight")
skills/           open Agent Skill (decision-check) used by the rovo:skill module
scripts/          dev.sh, validate-twg.mjs, strip-dev.mjs + deploy-prod.sh
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

Production: `scripts/deploy-prod.sh` strips the `# >>> dev-only` manifest blocks (the dev
web trigger would block "Runs on Atlassian" eligibility), runs `forge lint` and
`forge eligibility`, deploys to production and restores the dev manifest.
`scripts/deploy-prod.sh --check-only` does everything except the deploy.

## Demo

Video script and storyboard: [docs/DEMO.md](docs/DEMO.md). Devpost write-up draft: [docs/DEVPOST.md](docs/DEVPOST.md).

## License

MIT — see [LICENSE](LICENSE).
