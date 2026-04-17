# vibe-collab — Project Plan

## What are we building?

**R&D Pipeline Tracker + HTA Market Access Roadmap**

An intelligence product that tracks a medicine's full journey from clinical trials through regulatory authorization, HTA assessment, and reimbursement to patient access. Built for HTA bodies and pharmaceutical market access teams.

Three modules:
1. **R&D Pipeline Tracker** — clinical trial data from ClinicalTrials.gov + EU CTIS
2. **HTA Market Access Roadmap** — per-country HTA body + reimbursement pathway
3. **Treatment Landscape Intelligence** — WHO EML, formularies, guidelines (Sprint 2+)

Detailed plans in `.codex/plans/`:
- `HTA-REUSE-BACKBONE-PLAN.md` — donor extraction strategy
- `SPRINT-1-EXECUTION-PLAN.md` — 8-batch Sprint 1 plan
- `KASPER-DATA-TASKS.md` — Kasper's independent data curation work

## Stack decisions
- [x] React 19 + Vite 8 (fast, popular, great AI training data)
- [x] Tailwind CSS v4 (utility-first, no custom CSS headaches)
- [x] Vitest (test runner, zero config with Vite)
- [x] Backend: Express 4 (donor from EU Digital Strategy Tracker)
- [x] Database: PostgreSQL + pgvector
- [x] AI: Anthropic Claude via LLM Gateway (donor, vendor-neutral)
- [ ] Hosting: TBD (likely Hetzner/Coolify for EU sovereignty)

## Feature backlog

1. Sponsor search + detail page
2. Asset/drug detail with linked clinical trials
3. Country pathway visualization (HTA steps timeline)
4. Grounded chat (ask questions, get cited answers)
5. ClinicalTrials.gov live ingestion
6. NICE API HTA decision integration (Sprint 2)
7. Country compare mode (Sprint 2)
8. 5A friction scoring lens (Sprint 2)

## Who's working on what
| Person   | Current feature | Branch |
|----------|----------------|--------|
| James    | Sprint 1 architecture (batches 1-7) | main / feature branches |
| k4zzieB  | Data curation tasks (see KASPER-DATA-TASKS.md) | kasper/data-curation |

## What's done
- [x] Initial scaffold (React + Vite + Tailwind + Vitest)
- [x] CLAUDE.md project instructions
- [x] .codex/ planning folder
- [x] First tests passing (2 tests)
- [x] docs/vibe-coding-guide.md — full guide with patterns from a real build
- [x] docs/GETTING-STARTED.md — onboarding for new collaborators
- [x] k4zzieB added as collaborator
- [x] docs/COLLAB-WORKFLOW.md — how we coordinate (claims, branches, PRs, async/sync)
- [x] Deep research scoping (data sources, competitive landscape, architecture)
- [x] HTA backbone plan + donor extraction strategy
- [x] Sprint 1 execution plan (8 batches)
- [x] Kasper data curation tasks defined
