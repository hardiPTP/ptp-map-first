# PTP Map-First prototype

Everything Claude Code needs to build the map-first PTP prototype in one run.

```
CLAUDE.md                 standing rules (Claude Code reads this automatically)
docs/PRD.md               what to build
docs/IMPLEMENTATION.md    how, in phases, with parallel agents and gates
design/tokens.json        PTP design tokens pulled from Figma (fallback if Figma MCP is not connected)
.env.example              keys to fill in
```

## Before you run it (5 minutes)

1. Copy `.env.example` to `.env` and paste your Maps Demo Key into `VITE_GOOGLE_MAPS_API_KEY`. Leave the rest empty if you don't have them; the build has fallbacks.
2. Optional but recommended: in the Google Cloud console for the demo key's project, check Map Management. If you can create a Map ID (JavaScript, vector) with a warm, muted style and POIs hidden, put it in `VITE_GOOGLE_MAP_ID`.
3. Connect the Figma MCP to Claude Code so it reads the real design system. Follow Figma's MCP setup docs for Claude Code (at the time of writing: `claude mcp add --transport http figma https://mcp.figma.com/mcp`, then authenticate). Check with `claude mcp list`.
4. Make sure the frontend-design skill is available in Claude Code (`/plugin` to browse and install it if it is not).
5. Open a terminal in this folder and start Claude Code: `claude`. Pick Opus 5.5 with `/model`.

## The go prompt

Paste this as your first message:

```
Read CLAUDE.md, then docs/PRD.md and docs/IMPLEMENTATION.md in full before doing anything else. Then execute docs/IMPLEMENTATION.md phase by phase, Phase 0 through Phase 4, as the lead agent. Run the parallel agents exactly as each phase says, launching each phase's agents in one message so they run concurrently, using the sonnet model for builder agents and opus for the Phase 3 reviewer. Do not skip any gate: typecheck, tests, build and screenshots you have actually looked at. Never guess at Google Maps, Places or Firebase APIs; check the official docs first. Never invent venues or coordinates. Use the PTP Figma design system (via the Figma MCP, or design/tokens.json if it isn't connected) and load the frontend-design skill before any UI work. Keep docs/PROGRESS.md and docs/DECISIONS.md updated after every phase. Only stop to ask me if the Maps key is missing, the font is unavailable, or you reach the deploy step without Firebase credentials. Do not start Phase 5. When done, give me the final report described at the end of IMPLEMENTATION.md.
```

## After it finishes

- Run the app locally with the command in the final report and try it at phone size.
- For deploy, follow the steps the final report gives you (Firebase login and project).
- Traffic automation (Phase 5) is a separate go: tell Claude Code "Run Phase 5 of docs/IMPLEMENTATION.md".
