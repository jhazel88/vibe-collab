# vibe-collab — Session Rules

## Stack
- Frontend: React 19 + Vite 8 + Tailwind CSS v4
- Tests: Vitest + React Testing Library
- Styling: Tailwind utility classes only (no custom CSS unless necessary)
- Language: JavaScript (JSX), no TypeScript for now

## Conventions
- Functional components with hooks (no class components)
- File naming: kebab-case for files, PascalCase for components
- Components go in `src/components/`; tests go in `src/components/__tests__/`
- One component per file
- Props must have sensible defaults or be clearly required
- All new components should have a test file
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`

## Commands
- `npm run dev` — start dev server
- `npm test` — run tests (vitest)
- `npm run build` — production build
- `npm run lint` — check code style

## Current State
- Initial scaffold — no features built yet
- See `.codex/PLAN.md` for what's next
- Full vibe coding guide at `docs/vibe-coding-guide.md`

## Collaborators
- **James** (jhazel88) — repo owner
- **k4zzieB** — collaborator

## Collaboration Rules
- Each person works on their own branch (`name/feature-name`)
- Merge through pull requests on GitHub — don't commit directly to `main`
- Split by feature, not by layer (each person owns a whole feature end-to-end)
- Update `.codex/PLAN.md` when you start or finish a feature
- If the AI wants to "also fix this other thing" outside your feature — stop it

## Project Brain
- `.codex/PLAN.md` — what we're building, feature backlog, who's doing what
- `.codex/decisions.md` — key technical decisions and rationale
- `.codex/tasks/` — one spec file per feature (paste into AI conversations for context)

## Gotchas
- Tailwind v4 uses `@import "tailwindcss"` in CSS (not the old `@tailwind` directives)
- Vitest is configured in `vite.config.js` (not a separate config file)
- Start a fresh AI conversation for each feature — context rot is real
