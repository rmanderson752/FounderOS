-- 006_v4_week_and_conversation.sql
--
-- Founder OS v4, second pass: the week calendar and the goal conversation.
-- Requires 005.
--
-- Why this exists (2026-09-15, after the first ladder): a one-shot
-- decomposition of "get software job" had to write five assumptions that
-- were really questions. Goals now open as a conversation — a short
-- interview, the ladder proposed in-thread, refinements by talking — and
-- the week is planned onto a calendar from goals plus the user's recurring
-- commitments, which the conversation captures.
--
--   commitments        recurring or dated obligations: flexible weekly blocks,
--                      fixed-time commitments, daily habits, dated chores
--   plan_blocks.kind   what a block is (goal work, a commitment, a habit…)
--   plan_blocks.locked a block the user moved by hand; the planner leaves it
--   outcomes 'draft'   a goal exists from the first message of its thread
--   agent_messages     threads: one per goal (outcome_id) and one for the week

-- ---------------------------------------------------------------------------
-- commitments
-- ---------------------------------------------------------------------------
--   flexible  "outreach 90 min every Tuesday" — days_of_week + duration; the
--             planner picks the slot inside a free gap
--   fixed     "gym Mon/Wed/Fri 7:00–8:00" — days_of_week + fixed_start/end;
--             placed exactly there, like a calendar event
--   habit     "30 min LeetCode every weekday" — small, every listed day, sits
--             at the start of the first gap so it never eats the main block
--   chore     "submit the invoice by Sep 20" — one-off with due_date, placed
--             once before the date
CREATE TABLE IF NOT EXISTS public.commitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  outcome_id UUID REFERENCES public.outcomes(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('flexible', 'fixed', 'habit', 'chore')),
  -- 0 = Sunday … 6 = Saturday. Empty for chores.
  days_of_week INTEGER[] NOT NULL DEFAULT '{}',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  fixed_start TIME,
  fixed_end TIME,
  due_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commitments_user_active
  ON public.commitments(user_id, active);

DROP TRIGGER IF EXISTS update_commitments_updated_at ON public.commitments;
CREATE TRIGGER update_commitments_updated_at
  BEFORE UPDATE ON public.commitments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own commitments" ON public.commitments;
CREATE POLICY "Users manage own commitments" ON public.commitments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- plan_blocks: kind, commitment link, locked, source
-- ---------------------------------------------------------------------------
ALTER TABLE public.plan_blocks
  ADD COLUMN IF NOT EXISTS kind VARCHAR(10) NOT NULL DEFAULT 'goal',
  ADD COLUMN IF NOT EXISTS commitment_id UUID REFERENCES public.commitments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'planner';

ALTER TABLE public.plan_blocks DROP CONSTRAINT IF EXISTS plan_blocks_kind_check;
ALTER TABLE public.plan_blocks
  ADD CONSTRAINT plan_blocks_kind_check
  CHECK (kind IN ('goal', 'flexible', 'fixed', 'habit', 'chore'));

ALTER TABLE public.plan_blocks DROP CONSTRAINT IF EXISTS plan_blocks_source_check;
ALTER TABLE public.plan_blocks
  ADD CONSTRAINT plan_blocks_source_check
  CHECK (source IN ('planner', 'card', 'user', 'agent'));

CREATE INDEX IF NOT EXISTS idx_plan_blocks_user_kind_starts
  ON public.plan_blocks(user_id, kind, starts_at);

-- ---------------------------------------------------------------------------
-- outcomes: a goal exists as 'draft' from the first message of its thread
-- ---------------------------------------------------------------------------
ALTER TABLE public.outcomes DROP CONSTRAINT IF EXISTS outcomes_status_check;
ALTER TABLE public.outcomes
  ADD CONSTRAINT outcomes_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'done', 'abandoned'));

-- ---------------------------------------------------------------------------
-- agent_messages: threads
-- ---------------------------------------------------------------------------
-- outcome_id groups a goal's conversation. session_kind 'week' with a null
-- outcome_id is the calendar thread. 'card' and 'decompose' rows from the
-- first pass keep their meaning.
ALTER TABLE public.agent_messages
  ADD COLUMN IF NOT EXISTS outcome_id UUID REFERENCES public.outcomes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_agent_messages_outcome
  ON public.agent_messages(outcome_id, created_at)
  WHERE outcome_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_messages_user_kind
  ON public.agent_messages(user_id, session_kind, created_at DESC);
