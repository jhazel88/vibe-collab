# vibe-collab — Session Rules

## Stack
- Frontend: React 18 + Vite + Tailwind CSS v4
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

## Commands
- `npm run dev` — start dev server
- `npm test` — run tests (vitest)
- `npm run build` — production build

## Current State
- Initial scaffold — no features built yet
- See `.codex/PLAN.md` for what's next

## Collaboration
- Two developers working on this repo
- Each person works on their own branch (`name/feature-name`)
- Merge through pull requests on GitHub
- Don't commit directly to `main`

## Gotchas
- Tailwind v4 uses `@import "tailwindcss"` in CSS (not the old `@tailwind` directives)
- Vitest is configured in `vite.config.js` (not a separate config file)
