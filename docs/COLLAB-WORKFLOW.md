# How We Work Together

A practical playbook for two people vibe coding on the same repo.

---

## The Core Loop

```
1. Pull main          →  get each other's merged work
2. Claim a feature    →  update PLAN.md, create a branch
3. Build it           →  one feature, one AI conversation, commit often
4. Push + PR          →  open a pull request for the other person to glance at
5. Merge              →  squash merge into main
6. Repeat
```

## Before You Start a Session

```bash
cd vibe-collab
git checkout main
git pull
npm install          # in case the other person added dependencies
npm test             # make sure everything's green before you start
```

Then check `.codex/PLAN.md` — see what's claimed, what's free, what's done.

## Claiming a Feature

Before you build something, "claim" it so we don't collide:

1. Open `.codex/PLAN.md`
2. Add your feature to the backlog (if it's not there already)
3. Put your name + branch in the "Who's working on what" table
4. Commit that change to main (this is the one exception to the "no direct main commits" rule — coordination updates are fine)

```bash
# Quick coordination commit
git add .codex/PLAN.md
git commit -m "chore: claim header-nav feature"
git push
```

Then create your feature branch:

```bash
git checkout -b yourname/header-nav
```

## Building a Feature

Each feature = one branch = one (or a few) AI conversations.

**Start your AI conversation with context:**
> "I'm working on [feature] in the vibe-collab repo. Here's the current state: [paste from PLAN.md or the relevant task spec]. The stack is React 19 + Vite 8 + Tailwind v4 + Vitest."

**Or if using Cowork/Claude Code:** just open the folder — it reads CLAUDE.md automatically.

**While building:**
- Commit after every working change
- Run `npm test` frequently
- Stay in your feature's files — don't refactor shared code without coordinating
- If you need to touch a shared file (like App.jsx routing), mention it in the PR

## Finishing a Feature

```bash
# Make sure tests pass
npm test

# Push your branch
git push -u origin yourname/header-nav

# Open a PR (if you have gh CLI)
gh pr create --title "Add header nav" --body "Responsive header with mobile toggle"

# Or just open it on github.com
```

The other person takes a quick look — doesn't need to be a formal code review. Approve + squash merge.

After merge, update PLAN.md: move your feature to "What's done", clear your row in the table.

## Task Specs (Optional but Useful)

For anything non-trivial, write a quick task spec before building:

```bash
# Create a task file
touch .codex/tasks/header-nav.md
```

```markdown
---
id: header-nav
title: Responsive Header Nav
status: implementing
priority: P1
depends_on: []
---

## Goal
Add a responsive header with logo, nav links, and mobile hamburger menu.

## Files to create
- `src/components/header-nav.jsx`
- `src/components/__tests__/header-nav.test.jsx`

## Acceptance criteria
- [ ] Logo links to home
- [ ] Nav links render from a config array
- [ ] Hamburger menu on mobile (< 768px)
- [ ] Tests pass
```

This is gold for AI context — paste it into your conversation and the AI knows exactly what to build.

## Avoiding Collisions

The main risk with two people: editing the same file at the same time.

**Prevention:**
- Split by feature, not by layer (you own the whole vertical slice)
- Claim features in PLAN.md before starting
- Keep shared files (App.jsx, routing) minimal — add your route and that's it

**If it happens anyway:**
- Git will flag merge conflicts in the PR
- The person merging second resolves the conflict
- Usually it's just adding two different imports or routes — easy to fix

## When You're Stuck

1. Try 2-3 times with the AI
2. If it's not working, **don't doom loop** — start a fresh conversation
3. If still stuck, push what you have (even broken) and flag it:
   ```bash
   git commit -m "wip: header-nav stuck on mobile menu toggle"
   git push
   ```
   The other person can take a look with fresh eyes, or you can pair on it.

## Coordination Signals

We use PLAN.md as our "standup board." Keep it updated:

| Signal | Where | How |
|--------|-------|-----|
| "I'm working on X" | PLAN.md who's-working-on-what table | Claim before starting |
| "X is done" | PLAN.md what's-done checklist | Check it off after merge |
| "I made a decision" | .codex/decisions.md | Log it with rationale |
| "I need help" | GitHub PR comment or just text each other | Flag the branch |
| "New idea" | PLAN.md feature backlog | Add a line |

## Session Rhythm

If we're coding at the same time (sync):
- Quick check-in: "I'll take X, you take Y"
- Build independently on branches
- Merge one at a time to avoid conflicts
- Check in again when done

If we're coding at different times (async):
- Pull main, check PLAN.md, claim something, build, PR, push
- The other person merges when they're next online
