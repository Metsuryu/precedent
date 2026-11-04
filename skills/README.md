# Skills

`decision-check/SKILL.md` is an open (MIT) Agent Skill describing how to check work
against recorded decisions with Precedent's tools.

- **In Rovo** it ships as the `rovo:skill` module `decision-check` and is attached to
  the Precedent agent. Other Rovo agents can reuse it.
- **Outside Rovo** any Agent Skills-compatible client can load the folder, as long as
  it is connected to Precedent's MCP server (`rovo:mcp` module `precedent-mcp`, once
  an admin enables external access). Tool names exposed over MCP may carry a prefix;
  match them by suffix (`search-decisions`, `get-decision`, `check-issue`, `who-to-ask`).
