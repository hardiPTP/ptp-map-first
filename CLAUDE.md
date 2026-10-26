# PTP Map-First prototype: standing rules for Claude Code

Read this first, every session. Then docs/PRD.md and docs/IMPLEMENTATION.md, in full, before writing code.

## Source of truth

- docs/PRD.md decides WHAT to build. docs/IMPLEMENTATION.md decides HOW and in what order.
- If the PRD is silent on something, pick the simplest option that fits the PRD, and log it in docs/DECISIONS.md (one line: date, decision, why). Never add features the PRD does not ask for.
- If the PRD and IMPLEMENTATION.md disagree, the PRD wins. Log the conflict in docs/DECISIONS.md.

## No guessing

- Never invent API names, parameters or behaviour for Google Maps, Places, Routes or Firebase. Check the official docs (developers.google.com/maps, firebase.google.com/docs) with WebFetch before using anything you are not certain of, and note the URL in a code comment.
- Never invent places, addresses or coordinates. Seed venues come from Places API (New) responses only.
- If something cannot be verified, say so in docs/PROGRESS.md under "Unverified" instead of pretending it works.
- "Done" means run and checked: typecheck passes, tests pass, the screen was screenshotted and looked at. Not "the code looks right".

## Design

- The PTP design system in Figma ("Push the pin", fileKey ldoemly9GNCdo4TNCfyCZH) is the only visual source. Use the Figma MCP if connected; otherwise design/tokens.json.
- Load the frontend-design skill before writing any UI.
- Tokens only. No new colours, shadows, fonts or radii. The only allowed deviation is the type size override in design/tokens.json.
- Banned: purple/blue gradients, glows, Inter/Roboto/system fonts, emoji icons, default Tailwind grey cards with big soft shadows, extra glassmorphism, lorem ipsum or "Event 1" data, confetti, decorative empty states.

## Privacy and product rules that are easy to break

- Never show any user's name in the feed, on cards or on the map. Only inside that user's own account sheet.
- Users post as "Neighbour". "Push The Pin" posts are seeded or team-entered; the creation UI never offers them. "Place" is offered only to a device holding an ACTIVE claim on that place (PRD Addendum 2026-10-22, round 2).
- Map tags change on map idle only. No timers, no auto-rotation.

## Secrets and cost

- API keys live only in .env (gitignored). Never print, log or commit them. Never paste them into docs.
- The Maps Demo Key has an unpublished daily cap. Do not loop requests against it. No Google calls inside render loops, on every keystroke without a session token, or in tests (mock Google in unit tests).

## Working style

- Keep docs/PROGRESS.md updated at the end of every phase: what is done, what is verified, what is not, next step.
- Small commits per phase with clear messages.
- When running parallel agents, each agent only edits the files it owns (see IMPLEMENTATION.md, "File ownership").
