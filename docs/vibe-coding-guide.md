# Vibe Coding: What Actually Works

*Hard-won patterns from a 322-commit, 34-table, 2,800-test web app built almost entirely through AI conversations. These aren't theory — they're the things that survived contact with reality.*

---

## Part 1: The Basics (Start Here)

### What is vibe coding?

You describe what you want in plain English. An AI writes the code. You review it, run it, and iterate. The term comes from Andrej Karpathy (2025) and it's now a real way people build software — from weekend projects to production apps.

You don't need to be a developer. You need to know what you want, how to describe it clearly, and how to tell when the output is right or wrong.

### Pick a popular stack

AI models are trained on public code. The more popular a framework, the better the AI knows it. Stick to well-trodden paths:

- **Frontend:** React + Vite + Tailwind is the sweet spot right now. Huge training data, fast dev server, minimal config.
- **Backend:** Express (Node.js) or FastAPI (Python). Both are simple, well-documented, and AI-friendly.
- **Database:** PostgreSQL or Supabase (Postgres with a nice UI and auth built in).
- **Tests:** Vitest (works natively with Vite, zero config).

Obscure or brand-new libraries = more hallucinated APIs, more pain. Save the exotic stuff for later.

### Talk to the AI like you're briefing a new hire

The single most important skill in vibe coding is writing clear prompts. Imagine you hired someone talented who knows nothing about your project:

**Good prompt:**
> "I have a React component at `src/components/UserCard.jsx` that displays a user's name and email. I want to add a 'last active' timestamp below the email. The timestamp comes from `user.lastActive` (ISO 8601 string) and should display as relative time like '3 hours ago'. Use the `date-fns` library's `formatDistanceToNow` function."

**Bad prompt:**
> "Add a timestamp to the user card"

The good prompt gives: file path, current state, desired change, data shape, and the specific library to use. The AI doesn't have to guess anything.

### Commit after every working change

Git is your undo button. After every change that works:

```bash
git add -A
git commit -m "feat: add user card timestamp display"
```

Pro tip — make it even faster with an alias:

```bash
# Add to your ~/.bashrc or ~/.zshrc
alias yesdaddy="git add -A && git commit -m"

# Then just:
yesdaddy "feat: add user card timestamp display"
```

Use conventional commit prefixes so your history is scannable: `feat:` (new feature), `fix:` (bug fix), `chore:` (housekeeping), `refactor:` (restructuring).

### Don't trust — verify

The AI will confidently write code that looks perfect and is subtly wrong. Your job:

- **Run the code.** Click through it. Test the edges.
- **Read the code.** You don't need to understand every line, but skim it for obvious weirdness.
- **Watch for hallucinated APIs.** The AI sometimes invents function names that don't exist. If you get "X is not a function," that's what happened.

---

## Part 2: The Doom Loop (and How to Escape It)

The "doom loop" kills more vibe coding sessions than anything else:

1. You ask the AI to fix a bug
2. It changes something, introduces a new bug
3. You paste the new error
4. It changes something else, breaks what was already working
5. Repeat until everything is worse than when you started

**Escape routes:**

- **Stop after 2-3 failed attempts.** If the same bug isn't fixed after three tries, the AI doesn't understand the root cause.
- **Zoom out.** Say: "Don't write any code. Explain what you think the problem is and propose 2-3 approaches." Force it to reason before acting.
- **Start a fresh conversation.** Context rot is real — the longer a chat goes, the worse the AI gets. Bring just the relevant code and error into a clean chat.
- **Simplify.** Isolate the problem to the smallest case. Not "the page breaks" but "this component crashes when `user.lastActive` is null."
- **Ask a different AI.** If Claude is stuck, try ChatGPT (or vice versa). Different models genuinely see different things.

---

## Part 3: The System That Scales (Lessons from 322 Commits)

This is where it gets interesting. Most vibe coding advice stops at "write good prompts." That's fine for a weekend hack, but if you want to build something real, you need a system. Here's what emerged from building a production web app across 4 sprints, 35 batches, and thousands of AI conversations.

### The `.codex/` folder: your project brain

This is the single biggest unlock I found. At the root of the repo, I maintain a `.codex/` folder that contains everything the AI needs to understand the project. In my repo it grew to 389 files across several categories:

```
.codex/
├── V1-LAUNCH-EXECUTION-PLAN.md    # The current sprint plan
├── tasks/                          # One file per task (58 total)
│   ├── cellar-document-registry.md
│   ├── answer-contract-spec.md
│   └── ...
├── audits/                         # Quality gate artifacts
│   ├── gate-a-sign-off-2026-04-17.md
│   ├── cellar-integration-hostile-audit-2026-04.md
│   └── ...
├── prompts/                        # Reusable AI prompts
│   ├── v1-launch-plan-hostile-audit.md
│   └── ...
└── research/                       # Background research
    ├── independent-audit-2026-04-16.md
    └── ...
```

**Why this matters:** every AI conversation starts from zero. The AI doesn't remember your last session. The `.codex/` folder is your external memory — you paste the relevant task spec into a new chat and the AI instantly has full context. No warm-up, no re-explaining.

**Your starter version:** you don't need 389 files. Start with three:

```
.codex/
├── PLAN.md          # What you're building, what's done, what's next
├── tasks/
│   └── current.md   # The task you're working on right now
└── decisions.md     # Key choices you've made and why
```

### CLAUDE.md: the session rules file

Most AI coding tools support a persistent project instructions file that's loaded automatically. In Claude it's called `CLAUDE.md`, in Cursor it's `.cursorrules`.

This is different from your plan — it's operational rules. Mine says things like:

- What sprint and batch we're in
- Which batches are done (with commit hashes)
- Which files are in scope for the current batch (and which are off limits)
- Critical gotchas ("field is `source_ids` plural, not `source_id`")
- What conventions to follow

**Keep it under ~150 lines.** If it's too long the AI ignores parts of it. Link out to other files in `.codex/` instead of inlining everything.

**The key insight:** this file evolves with your project. After every sprint, I update it to reflect the new state. It's a living contract between you and the AI.

### The batch workflow: scope locks and numbered commits

This is the pattern that made the biggest difference to velocity:

1. **Plan the sprint.** Break the work into numbered batches. Each batch has a defined scope: which files it touches, what it delivers, what it depends on.

2. **Work one batch at a time.** Start a fresh AI conversation. Paste in the batch spec. Build only what's in scope. When it's done, commit with a batch-tagged message:
   ```
   feat(policypilot): ship compare stack — batch 1
   fix(seed): EHDS source linkage — batch 4
   feat(qa): rerunnable source-linkage audit script — batch 15
   ```

3. **Never touch files outside the current batch.** This is the discipline that prevents chaos. If the AI wants to "also fix this other thing while we're here" — stop it. That belongs to a different batch.

4. **Quality gates between sprints.** At the end of a sprint, run your audits, check your test count, verify the data. Don't start the next sprint until the gate passes.

Why this works: it turns a giant, overwhelming project into a series of small, completable units. Each batch is one conversation, one commit, one checkpoint. If batch 14 goes sideways, you roll back to batch 13 and try again.

From my git log — this is what 35 batches of disciplined work looks like:

```
feat(policypilot): EHDS evidence wave 3 (MT-SK) — batch 21C
feat(policypilot): EHDS evidence wave 2 (FR-LV) — batch 21B
feat(policypilot): EHDS evidence wave 1 (AT-FI) — batch 21A
feat(policypilot): evidence agent prompts + import script — batch 20
feat(policypilot): evidence schema migration 015 — batch 19
feat(policypilot): evidence-grounded analyst persona — batch 18
feat(policypilot): structured evidence tags — batch 17
chore(policypilot): status reconciliation — batch 16
feat(qa): rerunnable source-linkage audit script — batch 15
fix(seed): Other regulation source linkage — batch 14
...
```

Every line is a working checkpoint you can roll back to. Every batch is self-contained.

### Execution plans with dependency graphs

For bigger sprints, I write execution plans that include dependency graphs. This tells you which batches can run in parallel and which have to be sequential:

```
Batch 25 (data norm)  ──────────────────────────┐
Batch 26 (registry)  ───┐                        │
                         ▼                        │
Batch 27 (articles)  ───┤                        │
                         │                        │
                         ▼                        ▼
Batch 28 (contract)  ◄──── [27 done, 25 done]
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
Batch 29A (linking)  29B (cross-refs)  30 (citations)
```

You don't need this for a small project. But the moment you have more than ~5 batches, drawing the dependency graph saves you from starting work that's blocked on something else.

### Task specs with frontmatter

Every task gets its own markdown file with structured metadata:

```markdown
---
id: cellar-document-registry
title: CELLAR Document Registry
phase: launch-prep
status: spec_written
priority: P0
depends_on: []
---

## Goal
Fetch the CELLAR registry for all 19 EU instruments...

## New files
- `src/lib/cellar-client.js`
- `scripts/fetch-cellar-registry.js`

## Input shape
...

## Acceptance criteria
- [ ] Registry returns CELEX IDs for all 19 instruments
- [ ] Results cached to `api/db/seed-json/cellar-registry.json`
```

When you start a batch, paste the relevant task spec into the AI conversation. The AI gets: the goal, the files to create, the data shapes, and the acceptance criteria. It doesn't have to guess.

### Audit-driven development

This is the pattern that caught the most bugs and kept data quality high. The idea is simple: write scripts that verify your data and run them after every change.

My project has QA scripts that check things like: are all source records linked? Are there duplicates? Are required fields populated? These scripts run in seconds and catch problems the AI introduced without realizing it.

The more advanced version: **hostile audits.** I write prompts that tell the AI to be adversarial — "find every way this plan could fail, every assumption that's wrong, every edge case that's unhandled." Then I save the audit findings and treat them as binding constraints for the next sprint.

The progression:
1. Start with manual verification (run the app, click around)
2. Add automated tests (Vitest)
3. Add data validation scripts (custom QA scripts)
4. Add hostile audits (AI reviewing AI's work)

Each layer catches things the previous layers miss.

### Using multiple AIs (the multi-agent pattern)

One of the most powerful advanced techniques: use different AIs for different roles.

**Builder + Reviewer:** Your primary AI writes the code. A second AI (or a fresh conversation with the same AI) reviews it. The reviewer prompt:
> "Review this AI-generated code for: (1) correctness, (2) security vulnerabilities, (3) edge cases that would break it, (4) things you'd refactor. Don't rewrite — just flag issues."

(Internally, I call the reviewer agent "Mom" and the builder agent "Daddy." No technical significance, just makes the logs funnier.)

**Planner + Builder:** One conversation for architecture and spec writing (no code). A separate conversation for implementation. This keeps the builder's context clean and focused.

**Builder + Auditor:** After building a feature, paste it into a fresh chat: "Audit this for problems." The fresh context catches things the builder missed due to its own confirmation bias.

### Testing — let the AI write them

"I'm vibe coding, I don't need tests" is how you spend 4 hours debugging something a 30-second test would catch.

The setup is simple: install Vitest, add "Also write tests" to your prompts, run `npm test` after every change. The AI is genuinely good at writing tests — it generates edge cases you wouldn't think of.

My project hit 2,800+ tests across 140+ files. I didn't write them by hand. The AI generated them as part of each batch. They've caught dozens of regressions.

---

## Part 4: Collaborating on GitHub

### Setup (15 minutes)

**One person creates the repo:**
```bash
mkdir our-project && cd our-project
npm create vite@latest . -- --template react
git init
git add -A
git commit -m "chore: initial scaffold"
gh repo create our-project --public --source=. --push
```

**Add your collaborator:**
```bash
gh repo edit --add-collaborator their-github-username
```

**They clone it:**
```bash
git clone https://github.com/your-username/our-project.git
cd our-project
npm install
```

### The branch workflow

Never commit directly to `main`. Use named branches:

```bash
git checkout -b james/header-component
# ... work, commit as you go ...
git push -u origin james/header-component
gh pr create --title "Add responsive header" --body "Header with mobile nav toggle"
```

Your partner does the same on their branch. Merge through pull requests. This way you never collide.

### Split by feature, not by layer

This is critical for vibe coding specifically. Don't do "one person does frontend, one does backend." Do "one person builds the whole `/settings` page, the other builds the whole `/dashboard`."

Why? When you're vibe coding, the AI generates full-stack features in one go. Splitting by layer means you're constantly coordinating API contracts between two people, which creates merge headaches.

### Shared CLAUDE.md

Create a `CLAUDE.md` at the repo root and commit it. Both of you get the same project context in every AI conversation. Include: stack, conventions, who's working on what, and gotchas. Update it as you go.

### First-session game plan

1. **Pick the idea** (30 min) — What's the MVP? Smallest useful version.
2. **Pick the stack** (15 min) — Agree on framework, styling, hosting.
3. **Scaffold together** (30 min) — Set up repo, get it running on both machines.
4. **Divide two features** (15 min) — Each person takes one non-overlapping feature.
5. **Build, commit, PR, review** (remaining time) — Complete the full cycle once together.

---

## Part 5: What Claude Does Better (and When to Use Something Else)

**Claude's strengths:** long documents, planning, code review, following complex instructions, maintaining consistency across large contexts. It's the best planner I've found — the execution plans and task specs in my project were all written in Claude conversations.

**Where ChatGPT/Codex can complement:** wider general knowledge, sometimes better at quick debugging, different failure modes (when Claude is stuck, ChatGPT often isn't, and vice versa). Good as a second opinion.

**Where Cursor/Copilot fit:** in-editor autocomplete while you're hands-on-keyboard. Better for small tweaks than full features. Good for the "last mile" polish after the AI generates the main structure.

**The real advantage of Claude for this workflow:** it handles the `.codex/` system naturally. You can paste a 2-page execution plan with a dependency graph and it follows the batch boundaries, respects scope locks, and asks before touching files outside the current batch. That discipline is the whole game.

---

## Quick Reference Checklist

> *"In the beginning there was the prompt, and the prompt was with Daddy, and the prompt was good."* — The Book of Vibe, 1:1

**Before a session:**
- [ ] Plan/spec written? (even a paragraph)
- [ ] Fresh AI conversation?
- [ ] Relevant context pasted in? (task spec, current file)
- [ ] Git status clean?

**During:**
- [ ] One feature per conversation?
- [ ] Committing after every working change?
- [ ] Running the app to verify?
- [ ] Doom loop check: stop after 3 failed attempts?

**After:**
- [ ] Everything committed and pushed?
- [ ] Tests passing?
- [ ] CLAUDE.md / plan updated?

---

## Recommended Tools

| Tool | What It Is | Good For |
|------|-----------|----------|
| **Claude** | Strong at planning, review, long docs | Primary builder, planner |
| **ChatGPT / Codex** | Wide knowledge, quick debugging | Second opinion, audits |
| **Cursor** | VS Code with AI built in | In-editor vibe coding |
| **GitHub Copilot** | Autocomplete in your editor | Small tweaks, polish |
| **Vite** | Fast dev server and build tool | Frontend scaffold |
| **Vitest** | Test runner, native Vite support | Running your tests |
| **Vercel / Netlify** | One-click deploy | Getting live fast |

---

## Glossary

| Term | Definition |
|------|-----------|
| **Vibe coding** | Building software by describing what you want in natural language |
| **Context rot** | AI performance degradation as conversations get longer |
| **Doom loop** | Cycle of AI fixes making things progressively worse |
| **Hallucination** | When the AI confidently invents APIs or facts |
| **Batch** | A scoped unit of work with defined file boundaries |
| **CLAUDE.md** | Project instructions file loaded into every AI conversation |
| **Scope lock** | Rule: don't touch files outside the current batch |
| **Quality gate** | Checkpoint between sprints — tests, audits, data checks |
| **Hostile audit** | AI prompted to adversarially review AI's own work |
| **Fresh eyes** | Starting a new AI chat to get unbiased analysis |

---

## Further Reading

- [Softr — 8 Vibe Coding Best Practices](https://www.softr.io/blog/vibe-coding-best-practices)
- [ProductTalk — Avoid the Doom Loop](https://www.producttalk.org/vibe-coding-best-practices/)
- [Git and GitHub for Vibe Coders](https://deepakness.com/blog/git-for-vibe-coders/)
- [Builder.io — How to Write a Good CLAUDE.md](https://www.builder.io/blog/claude-md-guide)
- [Builder.io — 50 Claude Code Tips](https://www.builder.io/blog/claude-code-tips-best-practices)
- [Awesome Vibe Coding (GitHub)](https://github.com/filipecalegario/awesome-vibe-coding)
- [Google Cloud — Vibe Coding Explained](https://cloud.google.com/discover/what-is-vibe-coding)
- [Microsoft — Complete Beginner's Guide](https://developer.microsoft.com/blog/complete-beginners-guide-to-vibe-coding-an-app-in-5-minutes)

---

*Written April 2026. Good luck — go build something cool, Daddy.*

<!-- 
████████████████████████████████████████████████████████████████
██                                                            ██
██   If you're reading the raw source of this file,           ██
██   congratulations — you've found the final egg.            ██
██                                                            ██
██   This entire document is a psyop to get you to            ██
██   call yourself Daddy in professional contexts.            ██
██                                                            ██
██   There are 5 "Daddy" references in this file.             ██
██   You found this one. Good luck finding the rest.          ██
██                                                            ██
██   You cannot remove them. They are load-bearing.           ██
██                                                            ██
██   - James                                                  ██
██                                                            ██
████████████████████████████████████████████████████████████████
-->
