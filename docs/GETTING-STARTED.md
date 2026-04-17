# Getting Started with vibe-collab

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ installed
- [Git](https://git-scm.com/) installed
- A GitHub account
- An AI assistant (Claude, ChatGPT, Cursor, etc.)

## Setup (5 minutes)

```bash
git clone https://github.com/jhazel88/vibe-collab.git
cd vibe-collab
npm install
npm run dev        # starts dev server at http://localhost:5173
npm test           # runs tests (should see 2 passing)
```

## How this repo is organized

```
vibe-collab/
├── CLAUDE.md              ← AI reads this automatically (project rules)
├── .codex/                ← Project brain (plans, tasks, decisions)
│   ├── PLAN.md            ← What we're building + who's doing what
│   ├── decisions.md       ← Key choices and why we made them
│   └── tasks/             ← One file per feature/task
├── docs/
│   ├── GETTING-STARTED.md ← You are here
│   └── vibe-coding-guide.md ← Full vibe coding guide with tips & patterns
├── src/
│   ├── App.jsx            ← Main app component
│   ├── index.css          ← Tailwind import
│   └── components/        ← Your components go here
│       └── __tests__/     ← Tests go here
└── package.json
```

## Workflow

1. **Read the guide** — `docs/vibe-coding-guide.md` has everything you need
2. **Pick a feature** from `.codex/PLAN.md`
3. **Create a branch:** `git checkout -b yourname/feature-name`
4. **Build it** with your AI assistant — paste the task spec for context
5. **Test it:** `npm test`
6. **Commit often:** `git add -A && git commit -m "feat: what you built"`
7. **Push + PR:** `git push -u origin yourname/feature-name` then open a PR on GitHub

## Key rules

- Don't commit directly to `main` — use branches + PRs
- One feature per branch
- Write tests for new components (or ask the AI to)
- Update `.codex/PLAN.md` when you finish something

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server (hot reload) |
| `npm test` | Run all tests |
| `npm run build` | Production build |
| `npm run lint` | Check code style |
