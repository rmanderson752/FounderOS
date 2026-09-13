-- 005_v4_start_card.sql
--
-- Founder OS v4: the Start Card.
-- Requires 004 (outcomes, daily_plans, plan_blocks, agent_messages, agent_usage,
-- session_events must exist).
--
-- What this adds, and why each piece exists:
--   milestones              the persisted goal -> milestone -> candidate ladder.
--                           "State your goals and work backwards" has a table.
--   signals                 what the system observed: commits, Claude Code
--                           sessions, file activity. Pushed by hooks, never typed.
--   resolution_corrections  every time the user flips an inferred status. This is
--                           the ground truth the resolver is tuned against.
--   plan_blocks.*           links a block to a milestone, records how it was
--                           resolved and on what evidence, and adds 'unobserved'.
--   projects.*              repo/folder mapping so a commit can be attributed,
--                           plus weight and paused.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- users: the CLI / hook bearer token
-- ---------------------------------------------------------------------------
-- The local `fos` CLI and the git / Claude Code hooks authenticate with a
-- bearer token generated from Settings. Only its SHA-256 is stored; the
-- plaintext is shown once. A token is scoped to one user so the service-role
-- code paths (/api/signals, /api/card via bearer) can act as exactly that user.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hook_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_hook_token
  ON public.users(hook_token_hash)
  WHERE hook_token_hash IS NOT NULL;

-- ---------------------------------------------------------------------------
-- projects: how a signal is attributed, and how much an effort counts
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS repo_path TEXT,
  ADD COLUMN IF NOT EXISTS folder_paths TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'code',
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_kind_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_kind_check CHECK (kind IN ('code', 'docs', 'life'));
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_weight_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_weight_check CHECK (weight BETWEEN 1 AND 3);

-- ---------------------------------------------------------------------------
-- outcomes: the only prioritisation input the user ever sets is weight
-- ---------------------------------------------------------------------------
ALTER TABLE public.outcomes
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS decomposition_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assumptions TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.outcomes DROP CONSTRAINT IF EXISTS outcomes_weight_check;
ALTER TABLE public.outcomes
  ADD CONSTRAINT outcomes_weight_check CHECK (weight BETWEEN 1 AND 3);

-- ---------------------------------------------------------------------------
-- milestones — the ladder
-- ---------------------------------------------------------------------------
-- candidates is JSONB: [{ deliverable, estimated_minutes, expected_paths[] }].
-- They are suggestions the card turn picks from or rewrites, not tasks the
-- user maintains. already_done_evidence holds commit hashes when the
-- decomposition found the milestone finished before the goal was stated.
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  outcome_id UUID NOT NULL REFERENCES public.outcomes(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  definition_of_done TEXT,
  estimated_minutes INTEGER NOT NULL DEFAULT 120,
  position INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'done', 'skipped')),
  -- Re-dated every Sunday from observed pace. Never shown red.
  expected_by DATE,
  -- Monday of the week this milestone is a "rock" for, if any.
  focus_week DATE,
  candidates JSONB NOT NULL DEFAULT '[]',
  already_done_evidence JSONB NOT NULL DEFAULT '[]',
  created_by VARCHAR(10) NOT NULL DEFAULT 'model'
    CHECK (created_by IN ('model', 'user')),
  decomposition_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_outcome_position
  ON public.milestones(outcome_id, position);
CREATE INDEX IF NOT EXISTS idx_milestones_user_status
  ON public.milestones(user_id, status);

-- ---------------------------------------------------------------------------
-- signals — what actually happened
-- ---------------------------------------------------------------------------
-- external_id dedupes: a commit hash posted twice (queue flush after a retry)
-- must not become two signals.
CREATE TABLE IF NOT EXISTS public.signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  source VARCHAR(20) NOT NULL
    CHECK (source IN ('git', 'session', 'fs', 'manual', 'deploy')),
  kind VARCHAR(40) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  paths TEXT[] NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  -- For sessions: how long it ran. For commits: null.
  duration_minutes INTEGER,
  external_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_user_external
  ON public.signals(user_id, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signals_user_occurred
  ON public.signals(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_project_occurred
  ON public.signals(project_id, occurred_at DESC)
  WHERE project_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- plan_blocks: link to the ladder, record how the block was resolved
-- ---------------------------------------------------------------------------
ALTER TABLE public.plan_blocks
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_paths TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(10),
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3, 2),
  ADD COLUMN IF NOT EXISTS evidence_signal_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selection JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS start_command TEXT;

-- 'unobserved' replaces the guilt word. A block nobody saw evidence for is not
-- skipped; it is simply not observed, and it is re-derived tomorrow.
ALTER TABLE public.plan_blocks DROP CONSTRAINT IF EXISTS plan_blocks_status_check;
ALTER TABLE public.plan_blocks
  ADD CONSTRAINT plan_blocks_status_check
  CHECK (status IN ('planned', 'done', 'partial', 'skipped', 'unobserved'));

ALTER TABLE public.plan_blocks DROP CONSTRAINT IF EXISTS plan_blocks_resolved_by_check;
ALTER TABLE public.plan_blocks
  ADD CONSTRAINT plan_blocks_resolved_by_check
  CHECK (resolved_by IS NULL OR resolved_by IN ('observed', 'user', 'cron'));

-- ---------------------------------------------------------------------------
-- resolution_corrections — the ground truth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resolution_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES public.plan_blocks(id) ON DELETE CASCADE,
  from_status VARCHAR(20) NOT NULL,
  to_status VARCHAR(20) NOT NULL,
  from_confidence NUMERIC(3, 2),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_corrections_user
  ON public.resolution_corrections(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- instrumentation columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_events
  ADD COLUMN IF NOT EXISTS trace_id TEXT,
  ADD COLUMN IF NOT EXISTS usd NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER;

ALTER TABLE public.agent_usage
  ADD COLUMN IF NOT EXISTS cache_read_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_write_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd NUMERIC(10, 6) NOT NULL DEFAULT 0;

ALTER TABLE public.agent_messages
  ADD COLUMN IF NOT EXISTS session_kind VARCHAR(20) NOT NULL DEFAULT 'card';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_milestones_updated_at ON public.milestones;
CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_corrections ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['milestones', 'signals', 'resolution_corrections']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users manage own ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      'Users manage own ' || t, t
    );
  END LOOP;
END $$;
