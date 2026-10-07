# Decisions

One line each: date, decision, why.

- 2026-10-07: Maps key supplied by the human in chat; written only to `.env` (gitignored). Why: IMPLEMENTATION input table.
- 2026-10-07: No `VITE_GOOGLE_MAP_ID` supplied → map Mode B (no mapId, JSON styles, custom HTML markers), pending docs check in Phase 0 step 6. Why: IMPLEMENTATION Phase 0 step 6 fallback.
- 2026-10-07: No Firebase project → build and test on the Firestore/Auth emulators with project id `demo-ptp`. Why: IMPLEMENTATION input table.
- 2026-10-07: Font Stack Sans Text is on Google Fonts (weights 300/400/500), loaded from fonts.googleapis.com. Why: IMPLEMENTATION input table says check Google Fonts first.
- 2026-10-07: Java was missing (the Firestore emulator needs it); Homebrew is not installed, so a portable Temurin JDK 21 was downloaded into `.tools/` (gitignored); scripts set JAVA_HOME to it. Why: emulator gates can't run without it.
- 2026-10-07: The "frontend-design" skill named in CLAUDE.md is not installed in this environment. Used `figma:figma-design-to-code` (named in IMPLEMENTATION Phase 0.4) plus the CLAUDE.md design bans as the design guidance. Why: the named skill can't be loaded; this is the closest sanctioned guidance.
