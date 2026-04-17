# Decisions Log

Record key decisions here so future AI conversations have context on _why_ things are the way they are.

## 2026-04-17: Stack choice
**Decision:** React + Vite + Tailwind + Vitest
**Why:** Popular stack = best AI code generation quality. Vite is fast. Tailwind avoids CSS bikeshedding. Vitest works with Vite out of the box.
**Alternatives considered:** Next.js (overkill for now, can migrate later if needed), Vue (less AI training data than React).
