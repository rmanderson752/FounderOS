# Founder OS

**The Start Card.** At the start of every work period, one card: a single deliverable sized to the
time you actually have, the chain back to the goal it serves, what the system observed you do last,
and the command to begin. Nothing on the card is typed by you.

```
HNRY → TestFlight beta to 5 testers by Oct 24 → Milestone 2/5: auth + onboarding complete
NOW (2h10m until 15:30 showing):
  Wire Supabase sign-in on app/(auth)/SignInScreen.tsx and verify the happy path on the simulator.
Observed: 6 commits on ~/hnry Tue–Wed (commitments sanitizing, AuthStack scaffold). Session Wed 4:10pm.
Pace: needs ~22h; at ~5h/wk that lands Oct 30, target Oct 24.
Start: cd ~/hnry && claude "continue: wire Supabase sign-in on SignInScreen"
Signals as of 9:04.  fos no "…" to redirect · fos done · nothing needed otherwise
```

It is printed into Claude Code by a SessionStart hook when you open a repo, emailed at 07:30, and
shown on `/`. Goals are stated once and reverse-engineered by one structured-output call into a
persisted milestone ladder. Progress is observed from git commits and Claude Code sessions pushed by
hooks; blocks resolve without taps. Feasibility, selection and validation are pure, tested
TypeScript — the model does language only. See [DECISIONS.md](DECISIONS.md) for why.

## How it fits together

```
LOCAL (tools/fos/index.mjs — one file, no deps)
  SessionStart hook → GET /api/card → prints the card into the session
  post-commit hook  → POST /api/signals {hash, subject, paths}
  SessionEnd hook   → POST /api/signals {cwd, duration, first message (600 chars, redacted)}
  fos goal "…" --by 2026-10-24  → docs + 60 days of commits → POST /api/goals (dry run → y/n → save)

SERVER (Next.js 14, Vercel)
  /api/card        calendar → window (≤180m) → score outcomes (code) → one validated model turn → plan_blocks
  /api/signals     ingest → attribute to project → resolver marks blocks done/partial with evidence
  /api/goals       decomposition via messages.parse + zod schema → outcomes + milestones
  /api/jobs/daily  the one cron: keep-alive, close out yesterday, first-gap card + email, Sunday rocks

PURE (src/lib/planner, vitest)
  window · select · capacity · rechain · validate · resolve
```

Models: `claude-opus-5` for cards and decomposition, `claude-sonnet-5` for side calls. Prompt prefix
cached under one breakpoint; usage, cache hits, cost and latency recorded per turn.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL, RLS)
- **Auth:** Supabase Auth
- **State:** React Query (TanStack)
- **AI:** `@anthropic-ai/sdk` (tool runner, structured outputs), zod
- **Hosting:** Vercel

## Getting Started

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

Create (or restore) a project, then run the migrations **in order** in the SQL editor:
`001` → `002` → `003` → `004` → `005`. Copy the project URL, anon key and service-role key into
`.env.local`.

### 3. Secrets

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY — encrypts calendar tokens at rest
openssl rand -hex 24      # CRON_SECRET — Vercel Cron → /api/jobs/daily
```

Add `ANTHROPIC_API_KEY`. Optionally `RESEND_API_KEY` + `CARD_EMAIL_TO` for the 07:30 email.

### 4. Google Calendar (read-only)

In Google Cloud: enable the Calendar API, set the OAuth consent screen to **production** (testing mode
expires refresh tokens after 7 days), and register two redirect URIs:

- Sign-in: `https://<project-ref>.supabase.co/auth/v1/callback`
- Calendar: `http://localhost:3000/api/calendar/callback` (and the production equivalent)

### 5. Run

```bash
npm run dev
```

Sign in → Settings → Connect Google Calendar → set your work window → **Create token**.

### 6. Install the CLI and hooks

```bash
node tools/fos/index.mjs init --url http://localhost:3000 --token fos_…
node tools/fos/index.mjs map "HNRY=/Users/you/hnry"
node tools/fos/index.mjs goal "HNRY TestFlight beta to 5 testers" --by 2026-10-24 --project HNRY
node tools/fos/index.mjs doctor
```

Optional: `alias fos='node /absolute/path/to/founder-os/tools/fos/index.mjs'`.

### Tests

```bash
npm test                                      # planner + calendar, offline
RUN_LIVE=1 npx vitest run src/lib/card/live.test.ts   # one real card turn + one decomposition (cents)
```

## Project Structure

```
src/
├── app/(dashboard)/        /  (the card)  /goals  /goals/[id]  /signals  /settings  /legacy/*
├── app/api/                card · signals · goals · milestones · projects · blocks · calendar · jobs/daily
├── lib/planner/            pure: window, select, capacity, rechain, validate, resolve (+ tests)
├── lib/card/               anthropic client, frozen prompt, state block, tool turn, usage, render, build
├── lib/decompose/          ladder schema (zod) + the structured-output call
├── lib/signals/            attribution + ingest/resolver glue
├── lib/calendar/           Google OAuth (read-only), AES-256-GCM tokens, pure gap math (+ tests)
├── lib/jobs/               email
└── types/database.ts
tools/fos/index.mjs         the CLI and hooks
supabase/migrations/        001–005
DECISIONS.md                what was decided and why
```

## History

v1 (Jan 2026) was a founder dashboard. v2 (Mar 2026, tag `v2-final`, reachable at `/legacy`) was a
portfolio-first weekly template. Both required upkeep before they produced value and were abandoned.
v3 (Aug 2026) built the calendar gap math this version still uses. The case study for v2 is in
`output/`.
