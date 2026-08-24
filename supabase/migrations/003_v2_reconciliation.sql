-- 003_v2_reconciliation.sql
--
-- Reconstructs the v2 schema that was applied directly in the Supabase
-- dashboard and never committed. Migrations 001 and 002 define 11 tables;
-- the application actually reads 14. The nine tables below existed only in
-- the live database, and their shapes are recovered from src/types/database.ts.
--
-- Safe to run on a database that already has 001 and 002 applied, and safe to
-- re-run: every statement is idempotent.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- users: columns the app reads that neither 001 nor 002 creates
-- ---------------------------------------------------------------------------
-- 001 creates users with startup_name/stage; 002's CREATE IF NOT EXISTS is a
-- no-op once 001 has run, so daily_hours_available and work_days never land.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_id VARCHAR(40),
  ADD COLUMN IF NOT EXISTS daily_hours_available INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS work_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS review_day INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#6C5CE7',
  weekly_hours NUMERIC(5, 2) NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user
  ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_status
  ON public.projects(user_id, status);

-- ---------------------------------------------------------------------------
-- schedule_constraints — one row per weekday per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_constraints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  available_hours NUMERIC(4, 2) NOT NULL DEFAULT 6,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  UNIQUE (user_id, day_of_week)
);

-- ---------------------------------------------------------------------------
-- template_blocks — the v2 weekly template
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot VARCHAR(20) NOT NULL CHECK (slot IN ('morning', 'afternoon', 'full')),
  hours NUMERIC(4, 2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  gcal_event_id VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_blocks_user_day
  ON public.template_blocks(user_id, day_of_week, position);
CREATE INDEX IF NOT EXISTS idx_template_blocks_project
  ON public.template_blocks(project_id);

-- ---------------------------------------------------------------------------
-- agent_conversations — v2 agent transcripts (superseded by agent_messages
-- in 004, kept so the legacy routes keep working)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  context_type VARCHAR(30) NOT NULL DEFAULT 'general'
    CHECK (context_type IN ('general', 'template_generation', 'rebalance', 'review_insights')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user
  ON public.agent_conversations(user_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- agent_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_rebalance BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_digest BOOLEAN NOT NULL DEFAULT FALSE,
  personality VARCHAR(20) NOT NULL DEFAULT 'balanced'
    CHECK (personality IN ('concise', 'balanced', 'detailed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ---------------------------------------------------------------------------
-- google_calendar_tokens — v2 calendar connection. v3 replaces this with
-- calendar_connections (encrypted, multi-calendar) in 004.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  calendar_id VARCHAR(200) NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ---------------------------------------------------------------------------
-- project_metrics / project_metric_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'number'
    CHECK (type IN ('currency', 'number', 'percentage')),
  goal NUMERIC(14, 2),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_metrics_project
  ON public.project_metrics(project_id, position);

CREATE TABLE IF NOT EXISTS public.project_metric_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES public.project_metrics(id) ON DELETE CASCADE,
  value NUMERIC(14, 2) NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (metric_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_project_metric_entries_metric
  ON public.project_metric_entries(metric_id, week_start DESC);

-- ---------------------------------------------------------------------------
-- weekly_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  planned_hours JSONB NOT NULL DEFAULT '{}',
  actual_hours JSONB NOT NULL DEFAULT '{}',
  blocks_completed INTEGER NOT NULL DEFAULT 0,
  blocks_skipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_snapshots_user_week
  ON public.weekly_snapshots(user_id, week_start DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers (update_updated_at_column() is defined in 001)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_conversations_updated_at ON public.agent_conversations;
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_calendar_tokens_updated_at ON public.google_calendar_tokens;
CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS — same shape as v2: a row belongs to exactly one user
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_metric_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects',
    'schedule_constraints',
    'template_blocks',
    'agent_conversations',
    'agent_settings',
    'google_calendar_tokens',
    'project_metrics',
    'project_metric_entries',
    'weekly_snapshots'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users manage own ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      'Users manage own ' || t, t
    );
  END LOOP;
END $$;
