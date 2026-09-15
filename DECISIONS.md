# Decisions

The file a reviewer reads first, and the file that stops the goalposts moving.
Each entry records what was decided, when, and why. Reversals get a new entry;
nothing is edited in place.

## 2026-09-13 — v4: the Start Card

**Context.** v1 (Jan 2026) and v2 (Mar 2026) were built, written up, and not
used. The v3 brief (Aug 2026) shipped Phases 0–1 and then sat idle for 18 days.
Ryan's own diagnosis: "I never kept up with it — having to manually set goals
and steps." Every version has required upkeep before it produced value, and
every version's engagement curve was build burst → writeup → silence.

**Decision.** Build the Start Card: one card at the start of every work period
naming one deliverable, the chain back to the goal it serves, what the system
observed, and the command to begin. Nothing on the card is typed by the user.

### D1 — What killed v2: upkeep
Manual goals and steps. So: goals are stated once and decomposed by the model
into a persisted milestone ladder; progress is observed from git commits and
Claude Code sessions, not typed; blocks resolve without taps. The habit clock
starts when push observation ships (Phase 2), not before.

### D2 — Delivery: hook + email + web
"I don't ever open anything." The card is pushed: printed by a Claude Code
SessionStart hook when a repo is opened, emailed at 07:30 by the daily cron,
and shown on `/` as a fallback. All three render the same text from one API.

### D3 — Observation: push hooks, narrow scope
A git post-commit hook posts hash/subject/paths. A Claude Code SessionEnd hook
posts cwd, times, and the first user message (600 chars, secret-redacted). No
daemon, no polling, no full-transcript parsing. Per-project opt-out in
`fos init`.

### D4 — Model pin: Opus 5 in the loop, Sonnet 5 for side calls
Reverses the August pin to `claude-sonnet-4-6`. Sonnet 4.6 is previous
generation, costs more per equivalent request than Sonnet 5, lacks the effort
ladder, and retires no sooner than Feb 2027. Haiku 4.5 retires Oct 15 2026 and
its 4096-token cache minimum means a ~3K prompt never caches — never on the
critical path. One model per loop so caches stay valid. Effort is chosen by
the Phase 5 sweep; until then `medium` for cards, `high` for decomposition.

### D5 — Calendar: window only, capped at 180 minutes
Gap math sizes the card's window: [now, min(next event, work-window end,
now + 180m)]. Capacity comes from observed pace (session minutes per week),
with calendar free minutes only as an upper bound. A sparse calendar cannot
make the card wrong. To be confirmed against three real days once the
calendar is connected.

### D6 — First run: three outcomes
HNRY, the AI-engineer job search, and Founder OS itself. Float and Paddock
paused until Ryan says otherwise.

### D7 — v1/v2 code stays reachable
Ryan's call: keep unless needed. Tagged `v2-final`. The v2 Google write-scope
stack, v2 agent, and v2 pages stay in the tree, unlinked. Only conflicts are
touched: Settings now connects the v3 read-only calendar, `/goals` is the v4
ladder (v1 goals page moved to `/legacy/goals`), and API routes used by hooks
are excluded from the auth redirect.

### D8 — Success metric and kill criterion
Not 30 consecutive weekdays (false-negatives on a bursty cadence: 3, 29, 0, 3,
0, 24 commits/week). Instead: **30 work periods with a card viewed within 8
calendar weeks**, where a work period is a window ≥ 60 minutes with any
signal in it. **Kill/diagnose at 10 work periods** if fewer than half showed a
card or corrections outnumber accepts. "Skipped" is banned from the
vocabulary; an unresolved block is "unobserved".

### D9 — Infrastructure: free tiers, one cron
Supabase free tier (the existing project `botlicwjcsprmgjcvnus`, paused, to
be restored) plus a keep-alive query in the single daily Vercel cron. All
event-driven work (signals, cards) is push, so nothing needs sub-daily
scheduling.

### D10 — Portfolio timing: open
Founder OS is the portfolio piece unless application dates say otherwise.
Repo goes public at the end of Phase 1; the writeup is scheduled for week 4
of the usage run, not its end.

### Rules carried into the code
- The model does language only. Feasibility, re-dating, selection and
  validation are pure, unit-tested TypeScript in `src/lib/planner`.
- Decomposition is a bounded structured-output call, not an agent.
- No evaluation fixture that was not exported from real traffic.
- One block per work period; at most 3 rocks a week; never fill every gap.

## 2026-09-15 — Conversation and calendar (reversal of two "don't build" items)

**Context.** The first real ladder ("get software job", no docs, no commits)
had to write five assumptions — "no existing resume assumed", "targeting
full-time roles", "no active pipeline" — every one a question it should have
asked. Ryan, on seeing it: the agent needs to have a conversation, ask
questions, talk through steps and recurring tasks; and a calendar with tasks
and blocks needs to be front and center.

**Decision.** Two of the September 13 "what not to build" items are reversed,
deliberately and narrowly:

### D11 — The goal is a conversation, not a form
`/goals/new` creates a draft; `/goals/[id]` is a thread with the ladder beside
it. Short interview (one question per message, at most five, only where docs
and commits cannot answer) → `propose_ladder` in-thread → refine with tools
(`update_milestone`, `add/remove/reorder`, `set_goal`, `add_commitment`) →
`accept_ladder` activates the goal and plans the week. Bounded: a goal takes
about five minutes and a few dollars' worth of cents. The *daily* card stays
zero-input; the chat is at goal-setting time, which is rare.

### D12 — The week is planned onto a calendar, from accepted candidates only
`/` is a seven-day calendar: events, gaps, blocks by kind, due-date chips.
The pure planner (`src/lib/planner/week.ts`) places fixed commitments, habits,
chores, one goal block per day (rotating across goals), then flexible blocks
while whitespace allows (≤60% of free time). Deliverables come only from
candidates the user accepted in the conversation — the week draft schedules,
it never invents. Drag moves a block and locks it; "tell the planner" does the
same through tools. Locked, resolved, and started blocks are never re-planned.
The 30-hallucinated-deliverables risk that killed the Sunday draft in the brief
is gone because the candidates are already the user's.

### D13 — Commitments are first-class
`commitments`: flexible weekly blocks, fixed-time commitments, daily habits,
dated chores. Captured in conversation (`add_commitment`), placed by the
planner every week, each with a weekly quota so a moved occurrence is not
placed twice.

### D14 — A calendar connection is optional
Without Google, the work window counts as free time and everything still
works; connecting later only subtracts real events. Nobody should need a
Google Cloud console session before the product does anything.

### Found while testing, fixed
- History replay: messages written in one batch shared `created_at`, so a
  `tool_result` could replay before its `tool_use` (400 from the API). Now
  each message gets its own millisecond and `replayable()` drops orphans.
- Planner quota: a once-a-week commitment moved to another day was placed
  again on its original day. Kept blocks now count toward the quota.
- Rotation: kept goal blocks now count toward the rotation decay.
- Calendar grid now stretches to include blocks outside the work window
  (gym at 7am).
