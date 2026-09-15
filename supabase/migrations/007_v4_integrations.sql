-- 007_v4_integrations.sql
--
-- Founder OS v4: integrations. Requires 006.
--
-- A CRM (or anything with a webhook) is another observer and another source
-- of dated obligations. One inbound endpoint per integration,
-- /api/integrations/webhook/<token>, accepts a small JSON contract:
--
--   { "type": "activity", "title": "Called Acme", "occurred_at": "...", "project": "Sales" }
--        → a signal (source 'crm'), so blocks resolve from logged work
--   { "type": "task", "title": "Send proposal to Acme", "due_date": "2026-09-20", "duration_minutes": 45 }
--        → a chore, which the planner places before the date
--   { "type": "deal", "title": "Acme", "close_date": "2026-10-01", "stage": "..." }
--        → a chore "Close: Acme" due that date (idempotent on external_id)
--
-- HubSpot workflows, Attio automations, Pipedrive, Zapier/Make/n8n can all
-- POST that shape. Native connectors (OAuth) can be layered on the same
-- table later; kind records which.

CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL DEFAULT 'webhook'
    CHECK (kind IN ('webhook', 'hubspot', 'attio', 'pipedrive', 'notion', 'zapier')),
  name VARCHAR(100) NOT NULL,
  -- SHA-256 of the URL token. The plaintext is shown once.
  token_hash TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  events_received INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_user ON public.integrations(user_id);

DROP TRIGGER IF EXISTS update_integrations_updated_at ON public.integrations;
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own integrations" ON public.integrations;
CREATE POLICY "Users manage own integrations" ON public.integrations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- signals from a CRM
ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_source_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_source_check
  CHECK (source IN ('git', 'session', 'fs', 'manual', 'deploy', 'crm'));

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL;

-- chores that came from a CRM carry the external id so re-sent tasks update
-- rather than duplicate
ALTER TABLE public.commitments
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_commitments_integration_external
  ON public.commitments(integration_id, external_id)
  WHERE integration_id IS NOT NULL AND external_id IS NOT NULL;
