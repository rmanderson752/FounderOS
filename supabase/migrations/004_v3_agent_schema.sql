-- 004_v3_agent_schema.sql
--
-- Founder OS v3: calendar-driven daily planning.
-- Requires 003 (projects and schedule_constraints must exist).
--
-- Divergence from the v3 brief, per the multi-day planning decision:
-- daily_plans carries `origin` and `week_start` so a Sunday conversation can
-- draft Mon-Fri in one pass and weekday conversations refine each day.
-- The brief assumed today-only planning and omitted both columns.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- schedule_constraints: clock boundaries, not an hour count
-- ---------------------------------------------------------------------------
-- Gap computation subtracts events from a work window, so it needs a start and
-- end time. available_hours stays for the legacy routes but the daily path
-- ignores it. NULL means "fall back to 09:00-19:00" in lib/calendar/gaps.ts.
ALTER TABLE public.schedule_constraints
  ADD COLUMN IF NOT EXISTS work_start TIME,
  ADD COLUMN IF NOT EXISTS work_end TIME;

-- ---------------------------------------------------------------------------
-- calendar_connections — one row per user per provider
-- ---------------------------------------------------------------------------
-- access_token and refresh_token hold AES-256-GCM ciphertext, not plaintext.
-- Encryption happens in lib/calendar/crypto.ts using TOKEN_ENCRYPTION_KEY.
-- RLS is not sufficient on its own: a service-role query or a database dump
-- would otherwise expose live Google credentials.
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'google',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  calendar_ids TEXT[] NOT NULL DEFAULT '{}',
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/New_York',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

-- ---------------------------------------------------------------------------
-- outcomes — the large result that gets reverse engineered into daily work
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  definition_of_done TEXT,
  target_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'done', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_user_status
  ON public.outcomes(user_id, status);

-- ---------------------------------------------------------------------------
-- daily_plans — one row per day the agent produced a plan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  calendar_snapshot JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'abandoned')),
  -- 'week_draft': produced by a Sunday planning pass, provisional until the
  -- morning conversation for that date refines and accepts it.
  -- 'daily': produced by that day's own conversation.
  origin VARCHAR(20) NOT NULL DEFAULT 'daily'
    CHECK (origin IN ('daily', 'week_draft')),
  -- Set only for week_draft rows: the Monday of the drafted week, so a whole
  -- draft can be fetched, replaced, or abandoned as a unit.
  week_start DATE,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date
  ON public.daily_plans(user_id, plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_week
  ON public.daily_plans(user_id, week_start)
  WHERE week_start IS NOT NULL;

-- ---------------------------------------------------------------------------
-- plan_blocks — the blocks inside a day
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.daily_plans(id) ON DELETE CASCADE,
  outcome_id UUID REFERENCES public.outcomes(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  -- A finished artifact, never a project label. Server-validated in
  -- propose_day_plan: must be non-empty and must not equal a project or
  -- outcome name verbatim.
  deliverable VARCHAR(300) NOT NULL,
  rationale VARCHAR(500),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'done', 'partial', 'skipped')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT plan_blocks_ends_after_starts CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_plan_blocks_plan_position
  ON public.plan_blocks(plan_id, position);
CREATE INDEX IF NOT EXISTS idx_plan_blocks_user_starts
  ON public.plan_blocks(user_id, starts_at DESC);

-- ---------------------------------------------------------------------------
-- agent_messages — persistent conversation, one thread per user
-- ---------------------------------------------------------------------------
-- content is JSONB, not text: Anthropic message content is an array of blocks
-- (text, tool_use, tool_result) and has to be replayed verbatim.
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content JSONB NOT NULL,
  plan_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_user_created
  ON public.agent_messages(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- agent_usage — cost ceiling, one row per user per day
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  turns INTEGER NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date)
);

-- ---------------------------------------------------------------------------
-- session_events — the thirty day gate is only real if it is measured
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event VARCHAR(40) NOT NULL,
  event_date DATE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_events_user_date
  ON public.session_events(user_id, event_date);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_calendar_connections_updated_at ON public.calendar_connections;
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outcomes_updated_at ON public.outcomes;
CREATE TRIGGER update_outcomes_updated_at
  BEFORE UPDATE ON public.outcomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'calendar_connections',
    'outcomes',
    'daily_plans',
    'plan_blocks',
    'agent_messages',
    'agent_usage',
    'session_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users manage own ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      'Users manage own ' || t, t
    );
  END LOOP;
END $$;
