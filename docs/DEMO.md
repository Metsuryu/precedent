# Precedent — demo video script and storyboard (draft)

Target: **2:50–3:00** (judges may stop at 3:00; hard limit 5:00). Screen recording only,
our own TTS voice-over, **no music**, no third-party logos or trademarks beyond the
Atlassian products the app runs in. Public on YouTube (Mario uploads).

Site: `one-atlas-uyme.atlassian.net` (development install, seeded "Lumen Freight" data).
Before recording: browser at 1280×800 or 1920×1080, zoom 110–125%, hide bookmarks bar,
close notifications, Jira dark/light consistent across shots.

Narration pace ≈ 140 words/min. Word counts per scene are budgets.

## Pre-flight checklist (do once, right before recording)
- [ ] Decision log shows DEC-1…DEC-10 (Jira → Apps → Decision log).
- [ ] MOBL-58 panel shows **Possible contradiction: DEC-1** (refresh once to warm the cache).
- [ ] MOBL-63 panel shows "No related decisions".
- [ ] Rovo chat has the **Precedent** agent; a test prompt answers within ~10 s.
- [ ] Confluence page with the DEC-1 Decision record macro is editable by the signed-in human.
- [ ] Rovo Studio shows Precedent's tools (MCP / connected app) for scene 5.
- [ ] Delete any earlier "Decision context (Precedent)" comments on MOBL-58 so the scene-4 comment is the only one.
- [ ] Delete any smoke-test decisions created during browser checks (or re-seed) so ids match this script.

## Scenes

### 1. Problem — 0:00–0:18 (~40 words)
**Shot:** title card "Precedent — decision memory for Jira", then a text-only mock thread:
"Can we add Redis for search?" / "Didn't we decide no new datastores?" / "Did we? Who decided?"
**VO:** "Every team re-argues decisions it already made. The answer is buried in a Confluence
page from August, and nobody finds it until the work is half done. Precedent remembers what
your team decided, and warns you right where the work happens."

### 2. Capture in Confluence — 0:18–0:45 (~60 words)
**Shot:** Confluence page "Platform ADRs" → the **Decision record** macro rendering DEC-1
"No new datastores without an approved ADR" (owner Priya Raman, date, tags, rules-out terms).
Open the macro config briefly to show fields.
**VO:** "Decisions are captured where teams already write: a Decision record macro in
Confluence. Title, decision, rationale, owner, tags, and the things it rules out. When the
page is saved, a Forge trigger syncs it into the app's own storage. Everything runs on
Atlassian, with no external AI service."

### 3. The warning on the Jira issue — 0:45–1:25 (~90 words)
**Shot:** Jira issue **MOBL-58 "Add Redis cache for search"** → Precedent issue panel:
warning banner, **Possible contradiction: DEC-1**, why it matched, owner/date, source link;
related DEC-3 below. Click the source link → lands on the Confluence page. Back; open
**MOBL-63** (footer year) → "No related decisions" (shows it isn't noisy).
**VO:** "Here's a new ticket: add a Redis cache for search. The Precedent panel flags a
possible contradiction with DEC-1, decided by the Platform team on August twelfth, and shows
exactly why it matched and where it was decided. Matching is deterministic: keywords, tags,
components and the decision's own 'rules out' phrases, so results are explainable and
precomputed when the issue changes. And on an unrelated ticket, Precedent stays quiet."

### 4. Ask Rovo — 1:25–2:05 (~95 words)
**Shot:** Rovo chat → agent **Precedent** → starter "Does this issue contradict any past
decisions?" with MOBL-58 → answer cites DEC-1 with owner, date, link. Then "Who should I ask?"
→ who-to-ask answer (page owner/contributors/teams via Teamwork Graph; if TWG is unavailable
on the site, the answer falls back to the recorded owner — trim this line if so).
Then "Post a decision context comment" → agent confirms → the issue gets a comment
"Decision context (Precedent)" with a yellow warning panel citing DEC-1 (cut to the comment
on MOBL-58 for ~3 s). Then "Record a decision: Search uses the existing Postgres full-text
index" → confirm → "Supersede" demo optional if time allows (cut first if over 3:00).
**VO:** "The same memory powers a Rovo agent. Ask whether this issue contradicts anything,
and it cites the decision, who made it and when. Ask who to talk to, and it reads the
Teamwork Graph: the page owners, contributors and their teams. With one confirmation, it
posts that context as a comment on the issue for the whole team. When the team settles
something new, the agent records it, or supersedes the old decision."

### 5. Decision log + reuse everywhere (MCP, skill) — 2:05–2:40 (~75 words)
**Shot:** Jira → Apps → **Decision log**: counts, search "datastore", status filter
Superseded → DEC-8 "Superseded by DEC-9" (dev-site ids; verify on the day); click **Record decision** to show the modal.
Then Rovo Studio showing Precedent's tools available to other agents (MCP server
`precedent-mcp`) and the GitHub file `skills/decision-check/SKILL.md`.
**VO:** "Admins get a searchable decision log, with record and supersede built in. And
Precedent isn't locked inside one agent: its seven actions ship as a reusable Rovo skill and
as tools on a Forge MCP server, so any Rovo Studio agent, or an approved MCP client, can
check work against your team's decisions. The procedure is published as an open agent skill."

### 6. Architecture + close — 2:40–2:58 (~40 words)
**Shot:** one static slide: Confluence macro + triggers → Forge Custom Entity Store →
services → {issue panel, decision log, Rovo agent + skill, MCP server}; Teamwork Graph
read side; badge "Runs on Atlassian". End card: "Precedent — decision memory for Jira".
**VO:** "Precedent is a single Forge app on Jira and Confluence, running entirely on
Atlassian. Stop re-arguing settled decisions. Precedent: decision memory for Jira."

## Production notes
- TTS: generate per-scene audio files so timing can be adjusted per scene; trim silence.
- Record each scene separately; cut on clicks. Total VO ≈ 395 words ≈ 2:50.
- Captions: burn in or upload SRT (same text as VO) — helps judges watching muted.
- Seed text is fictional ("Lumen Freight"); no real customer data on screen.
- Keep the URL bar visible in scene 3 once (shows it's a real Atlassian site).

## Open dependencies (must be resolved before recording)
1. Teamwork Graph "who to ask": diagnosed 2026-11-04 — app-authored pages have no resolvable
   people, so the panel shows a note and falls back to the recorded owner. Use the human-owned
   page (Claim path, 2026-11-05) so TWG returns real people; otherwise trim the TWG line in scene 4.
2. Human-editable Confluence page for scene 2: resolved 2026-11-05 via the Claim path
   (human-authored child page). Verify in the browser on the recording day.
3. Rovo Studio MCP listing (shows as connected app, not "Precedent decisions") — confirm
   what judges will see and phrase scene 5 accordingly.
4. Production includes post-decision-context: resolved 2026-11-27 (prod 2.3.0, eligible for
   Runs on Atlassian). Note: prod has no installs yet; one-atlas-uyme runs the development
   install, so record there or on a fresh site installed via the install link.
