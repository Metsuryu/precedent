---
name: decision-check
description: Check planned work against a team's recorded engineering decisions before it is built. Use when someone asks "has this been decided before?", when reviewing or refining a Jira issue, or when a change might contradict an earlier decision (for example switching a datastore, changing an API version, or relaxing a security rule). Finds related decisions, flags possible contradictions, and names who decided and who to ask now. Also use when the user asks to record a new decision, to supersede an older one, or to post a decision context comment on an issue.
license: MIT
compatibility: Needs the Precedent tools (Forge app "Precedent", also exposed through its Rovo MCP server).
allowed-tools: search-decisions get-decision check-issue who-to-ask record-decision supersede-decision post-decision-context
---

# Decision check

Use this procedure to stop teams from re-arguing settled decisions or quietly
contradicting them. Only report what the tools return; never invent decisions,
owners, dates or teams.

## 1. Find the relevant decisions

- If there is a Jira issue (a key such as `PROJ-123`, or the issue the user is
  viewing), call `check-issue` with that key. It returns related decisions, a
  `possibleContradiction` flag per decision, and `why` each one matched.
- Otherwise call `search-decisions` with 1-4 topic keywords (for example
  `datastore`, `API v1`, `admin sessions`). Try one or two rephrasings before
  concluding nothing exists.

## 2. Read before you judge

- For each decision you will mention, use `get-decision` if you need the full
  rationale, the status, or what superseded it.
- A decision with `status: superseded` is no longer binding. Point to the decision
  in `supersededBy` and evaluate against that one instead.
- `possibleContradiction` is a heuristic. Quote the relevant line of the decision
  and say the work *may* contradict it; let the humans decide.

## 3. Find who to ask

- For any contradiction (or when the user asks who decided), call `who-to-ask`
  with the decision id, plus the issue key when there is one.
- Prefer, in order: the recorded owner, then the page owners and creator, then
  contributors, then teams (the people's teams and the teams linked to the
  issue's project).
- If `errors` is non-empty or the lists are empty, fall back to the recorded owner
  and say that Teamwork Graph had no extra data.

## 4. Answer

Keep it short:

1. One-line verdict: "Possible contradiction with DEC-n", "Related decisions found",
   or "No recorded decision covers this".
2. One bullet per relevant decision: id, title, what was decided, who decided and
   when, and the source link.
3. For contradictions: who to ask, and the two options - change the plan, or record
   a new decision that supersedes the old one (use `supersede-decision`, or the
   Confluence "Decision record" macro).

## 5. Record or supersede (only when the user asks)

- Never invent title, decision text, owner, date, tags, or conflict terms. Confirm
  the fields with the user before calling a write tool.
- To capture a new decision: call `record-decision` with at least `title` and
  `decision`. Pass `issueKey` when recording from an issue (or omit it so the
  issue in context is used). Reply with the new decision id.
- To replace an older decision: call `supersede-decision` with the old
  `decisionId` plus `title` and `decision` for the new one. After it succeeds,
  cite both ids (old now `superseded`, new `active` with `previous.supersededBy`
  pointing at the new id).
- If a tool returns `error`, explain it and ask for the missing field; do not guess.

## 6. Post a decision context comment (only when the user asks)

- When the user wants the findings left on the issue for the team, call
  `post-decision-context` with the issue key (or omit it to use the issue in
  context) and an optional short `note` from the user.
- Confirm before posting: it adds a visible comment as the user. Do not post it
  on your own initiative, and do not post it twice for the same check.
- Reply with a one-line confirmation and the number of decisions it listed.
