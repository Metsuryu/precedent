# Precedent — Devpost write-up (draft)

Status: **draft** for Mario to review and paste into Devpost (codegeist2026.devpost.com).
Placeholders in `<ANGLE BRACKETS>` must be filled before submitting. English only.

- **Category:** Apps for Software Teams
- **Bonus pools:** Agents, MCP, Teamwork Graph (one submission can win at most one bonus;
  entering three only widens the odds). Marketplace bonus skipped.
- **Installation link:** <https://developer.atlassian.com/console/install/d493a6cd-d4e5-4281-94bf-0ba3be5e255a?signature=AYABeNDkcz2Xldb7dwhoMkT4FRAAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBMYrtYxtKds6S7irURgaajQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDInj%2Bh9sQzMh%2ByS%2BsQIBEIA7n2fwrhy%2BzRboDzg1wA0100Wr1YH0KjQXf4WTq5f26h%2B6oLQdxkIs4TuhPyWujtiZlzlC2%2FgrXvSiQOcAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgGiYSDwAG%2FO9H5C5YkC8FvaAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMQSG9n948Jj7BoSxIAgEQgDthwku%2FQX07MA9HXjEla958vUbFEz6R7uAhcUXbwgwKcJkq2den6qeKw6IQvgwlzlDEP3jyXPn%2BZubw6wAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAVg7nEk%2Bpsir%2BBEtLaVIlu4AAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxwDZTzxGSMHVZl5t8CARCAO9VMA643JnXMAutOU%2BDrz8Yy5gcfErXMoClA7m6lZLJfead%2BEEYUwDLKl8qA8TvhwkxPIEmOUQMPckt3AgAAAAAMAAAQAAAAAAAAAAAAAAAAALr2779VUxy%2FQLa1XuXWspn%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADJB4vwyZ3F0DxWL8ZNdVftNiwPiVgTek3mvjYXhw72U8DPLXUh%2BMAiIeGzlI%2Ba%2BVsx8A4c1EhZkqPV3AqDHqVaX3rU%3D&product=jira&product=confluence>
- **Video (public YouTube, < 3 min):** `<YOUTUBE URL>`
- **Code:** https://github.com/Metsuryu/precedent (public, MIT)

---

## Tagline (≤ 200 chars)
Precedent remembers what your team already decided and warns you on the Jira issue that
quietly contradicts it, with who decided, when, and who to ask.

## Inspiration
Every team re-argues decisions it already made. "Didn't we agree on no new datastores?"
"Did we? Who decided?" The answer usually sits in a Confluence page from months ago, and
nobody finds it until the work is half done. Precedent turns those decisions into
something Jira, Rovo and other agents can check automatically.

## What it does
- **Capture:** a Confluence **Decision record** macro (title, decision, rationale, owner,
  date, tags, components, "rules out" terms, status). Saving the page syncs the decision.
  Decisions can also be recorded or superseded from Jira (Decision log page) or by asking
  the Rovo agent.
- **Surface:** the **Precedent** Jira issue panel lists related decisions on every issue and
  flags **possible contradictions** (e.g. an issue proposing Redis vs. "no new datastores"),
  with owner, date, status (active / superseded) and a link to the source page.
- **Decision log:** a Jira global page with search, status and tag filters, plus
  Record / Supersede forms. Empty installs get a one-click **Load sample decisions**.
- **Ask:** the **Precedent** Rovo agent answers "Has this been decided before?", "Does this
  issue contradict anything?", "Who should I ask?", and can record or supersede decisions.
- **Who to ask:** Teamwork Graph adds the decision page's owners, creator, contributors,
  their teams, teams linked to the issue's project, and linked pages.
- **Any agent:** the same tools are exposed through a `rovo:mcp` server and an open
  Agent Skill (`skills/decision-check/SKILL.md`).

## How we built it
- Forge app, UI Kit frontends: `macro` (Confluence), `jira:issuePanel`, `jira:globalPage`.
- Storage: Forge Custom Entity Store (`@forge/kvs`) — **Runs on Atlassian**, no external
  services, no outside LLM. Matching is deterministic: BM25-style keyword scoring +
  tag/component overlap + "rules out" restriction phrases. Rovo provides the
  natural-language layer.
- One service layer (`services/precedent.js`) shared by every surface: panel resolvers,
  six Rovo `action` modules (search-decisions, get-decision, check-issue, who-to-ask,
  record-decision, supersede-decision), and the MCP tools.
- Triggers: Confluence page created/updated → resync decision macros; Jira issue
  created/updated → precompute panel matches. A decision-log version counter invalidates
  per-issue caches, so the panel is fast on repeat views.
- Teamwork Graph (Preview) via `api.asUser().requestTeamworkGraph` with curated queries,
  so results respect what the viewer can see. Queries are validated against the site's
  live TWG schema in CI-style scripts.
- Production builds strip the development-only web trigger, keeping the app eligible for
  **Runs on Atlassian**.

## Challenges we ran into
- **Teamwork Graph and app-authored pages:** pages created by a Forge app user come back
  as null people nodes. We classify those as "no human authors" notes instead of errors,
  fall back to the recorded owner, and let a human "claim" the demo page so they become a
  real contributor.
- **Keeping the panel fast** without an external index: precompute on issue events and
  version-stamped caches.
- **One logic layer, many surfaces:** the panel, Rovo agent, MCP server and skill all give
  the same answer because they share one service module.

## Accomplishments that we're proud of
- A real "you're about to contradict DEC-1" moment on a Jira issue, with zero setup beyond
  installing the app.
- Agent-ready by design: actions, skill and MCP tools reuse the same code.
- Runs on Atlassian: no data leaves Atlassian.

## What we learned
Teamwork Graph is powerful for "who to ask", but its answers depend on real human
activity, so graceful degradation matters. Deterministic matching plus Rovo for language
is enough for decision recall, with no external AI.

## What's next
Decision suggestions from Jira comments and resolved issues, Slack-free reminders when a
superseded decision is still referenced, Jira Service Management support, and a
`graph:connector` to push decisions into Teamwork Graph.

---

## Bonus write-ups

### Agents
Precedent ships a `rovo:agent` ("Precedent") plus seven reusable `action` modules and a
`rovo:skill` (`decision-check`). Any Rovo agent can call search-decisions, check-issue or
who-to-ask to check work against past decisions, post-decision-context to leave a "Decision context" comment on the issue, and record-decision / supersede-decision
to keep the log current.

### MCP
The `rovo:mcp` module (`precedent-mcp`, "Precedent decisions") exposes the same tools to
Rovo Studio agents and admin-approved MCP clients. The review procedure is published as an
open Agent Skill (`skills/decision-check/SKILL.md`) that third-party agents can follow.
<NOTE: confirm in Rovo Studio how the tools are listed (MCP server vs connected app) and
adjust this wording before submitting.>

### Teamwork Graph
Precedent reads Teamwork Graph with `requestTeamworkGraph` as the viewing user: Confluence
page owners/creator/contributors and linked pages for the decision's source page, the
teams of those people, and teams linked to the issue's project. That turns "who decided?"
into "who to ask now", filtered by the viewer's permissions.

---

## Setup instructions for judges
1. Open the installation link: <https://developer.atlassian.com/console/install/d493a6cd-d4e5-4281-94bf-0ba3be5e255a?signature=AYABeNDkcz2Xldb7dwhoMkT4FRAAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucBMYrtYxtKds6S7irURgaajQAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDInj%2Bh9sQzMh%2ByS%2BsQIBEIA7n2fwrhy%2BzRboDzg1wA0100Wr1YH0KjQXf4WTq5f26h%2B6oLQdxkIs4TuhPyWujtiZlzlC2%2FgrXvSiQOcAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgGiYSDwAG%2FO9H5C5YkC8FvaAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMQSG9n948Jj7BoSxIAgEQgDthwku%2FQX07MA9HXjEla958vUbFEz6R7uAhcUXbwgwKcJkq2den6qeKw6IQvgwlzlDEP3jyXPn%2BZubw6wAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAVg7nEk%2Bpsir%2BBEtLaVIlu4AAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxwDZTzxGSMHVZl5t8CARCAO9VMA643JnXMAutOU%2BDrz8Yy5gcfErXMoClA7m6lZLJfead%2BEEYUwDLKl8qA8TvhwkxPIEmOUQMPckt3AgAAAAAMAAAQAAAAAAAAAAAAAAAAALr2779VUxy%2FQLa1XuXWspn%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADJB4vwyZ3F0DxWL8ZNdVftNiwPiVgTek3mvjYXhw72U8DPLXUh%2BMAiIeGzlI%2Ba%2BVsx8A4c1EhZkqPV3AqDHqVaX3rU%3D&product=jira&product=confluence>. Install on your Jira site; also choose
   Confluence on the same site if prompted (Confluence is optional but enables the macro).
2. In Jira, open **Apps → Decision log**. On a fresh install the log is empty: click
   **Load sample decisions** (fictional "Lumen Freight" data).
3. Create a Jira issue such as *"Add Redis cache for shipment search"*. Open it: the
   **Precedent** panel flags a possible contradiction with the "no new datastores"
   decision.
4. Open Rovo chat → agent **Precedent** → ask "Does <ISSUE-KEY> contradict any decision?"
   or "Who should I ask about DEC-1?".
5. Optional: in Confluence, insert the **Decision record** macro on any page, fill it in and
   publish; the decision appears in the Decision log and in matching Jira panels.
6. Optional: in Rovo Studio, create an agent and add Precedent's tools / the
   decision-check skill.

Notes: Teamwork Graph is in Preview; on a brand-new site with little activity the
"who to ask" line falls back to the decision's recorded owner. No data leaves Atlassian.
<VERIFY steps 2–4 on a fresh-site production install before submitting.>

## How it meets the technical requirements
Built on Forge (new for Codegeist 2026), integrating Jira, Confluence, Rovo and Teamwork
Graph. Runs on Atlassian (Forge storage only, no egress).
