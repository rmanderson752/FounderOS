-- 008_v4_chains.sql
--
-- Founder OS v4: habit chains. Requires 007.
--
-- Time blocking answers "when"; it does not answer "how do I start". A chain
-- does: gym is easy to start, gym earns the coffee and the LeetCode, and by
-- the time the deep-work link arrives you are already at the machine. Only
-- the anchor is on the clock; every other link's time is derived by summing
-- durations, so a late start shifts the chain instead of "missing" it.
--
-- The default day is four chains:
--   Rise       after waking; habit links; flows into Work
--   Work       6–8h ceiling; the only chain the planner packs (goal blocks
--              from the ladders, flexible commitments, chores)
--   Live       4–5h; protected — the planner never adds anything
--   Wind down  30–60 min before bed; ends with tomorrow's card
--
--   chains        the day template, one row per chain
--   chain_links   ordered links in a chain (a habit, a fixed thing, a goal
--                 slot the planner fills, a chore slot, free time)
--   chain_runs    the chain on a given day: planned anchor, actual start,
--                 how far along it is
--   plan_blocks   each block now knows its run and link position

-- ---------------------------------------------------------------------------
-- chains
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  role VARCHAR(12) NOT NULL DEFAULT 'custom'
    CHECK (role IN ('rise', 'work', 'live', 'winddown', 'custom')),
  -- order within the day
  position INTEGER NOT NULL DEFAULT 0,
  -- trigger: starts when the user starts it (tap, hook); anchor_time is the
  --          clock fallback used for planning and if nothing starts it
  -- after_previous: starts when the previous chain ends
  -- clock: starts at anchor_time
  -- before_bed: ends at anchor_time; start is derived backward from the links
  anchor_kind VARCHAR(16) NOT NULL DEFAULT 'after_previous'
    CHECK (anchor_kind IN ('trigger', 'after_previous', 'clock', 'before_bed')),
  anchor_time TIME,
  -- ceiling in minutes; null = the sum of the links
  target_minutes INTEGER,
  days_of_week INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  -- the planner may add goal work, chores and flexible commitments here
  plannable BOOLEAN NOT NULL DEFAULT FALSE,
  -- the planner never adds anything here; only the user's own links
  protected BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chains_user_position ON public.chains(user_id, position);

-- ---------------------------------------------------------------------------
-- chain_links
-- ---------------------------------------------------------------------------
-- kind:
--   habit / fixed / flexible / chore  a named link, usually mirroring a commitment
--   goal        a deep-work slot the planner fills from the ladders;
--               duration_minutes is the slot's maximum
--   free        unplanned time inside the chain (Live is mostly this)
CREATE TABLE IF NOT EXISTS public.chain_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title VARCHAR(200) NOT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'habit'
    CHECK (kind IN ('habit', 'fixed', 'flexible', 'goal', 'chore', 'free')),
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  commitment_id UUID REFERENCES public.commitments(id) ON DELETE SET NULL,
  -- null = every day the chain runs
  days_of_week INTEGER[],
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chain_links_chain_position ON public.chain_links(chain_id, position);

-- ---------------------------------------------------------------------------
-- chain_runs — the chain on a given day
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chain_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chain_id UUID NOT NULL REFERENCES public.chains(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  -- where the planner laid it
  anchor_at TIMESTAMPTZ NOT NULL,
  -- when it actually started (trigger tapped, first link done, hook fired)
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- position of the next link to do
  current_position INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'done', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, chain_id, run_date)
);

CREATE INDEX IF NOT EXISTS idx_chain_runs_user_date ON public.chain_runs(user_id, run_date);

-- ---------------------------------------------------------------------------
-- plan_blocks: which run and link a block belongs to
-- ---------------------------------------------------------------------------
ALTER TABLE public.plan_blocks
  ADD COLUMN IF NOT EXISTS chain_run_id UUID REFERENCES public.chain_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chain_link_id UUID REFERENCES public.chain_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_position INTEGER;

-- 'free' joins the block kinds for Live's unplanned band
ALTER TABLE public.plan_blocks DROP CONSTRAINT IF EXISTS plan_blocks_kind_check;
ALTER TABLE public.plan_blocks
  ADD CONSTRAINT plan_blocks_kind_check
  CHECK (kind IN ('goal', 'flexible', 'fixed', 'habit', 'chore', 'free'));

CREATE INDEX IF NOT EXISTS idx_plan_blocks_run ON public.plan_blocks(chain_run_id, link_position)
  WHERE chain_run_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- users: bedtime and wake time defaults for the Rise / Wind down anchors
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wake_time TIME,
  ADD COLUMN IF NOT EXISTS bed_time TIME;

-- ---------------------------------------------------------------------------
-- triggers + RLS
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_chains_updated_at ON public.chains;
CREATE TRIGGER update_chains_updated_at BEFORE UPDATE ON public.chains FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_chain_links_updated_at ON public.chain_links;
CREATE TRIGGER update_chain_links_updated_at BEFORE UPDATE ON public.chain_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_chain_runs_updated_at ON public.chain_runs;
CREATE TRIGGER update_chain_runs_updated_at BEFORE UPDATE ON public.chain_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['chains', 'chain_links', 'chain_runs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users manage own ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', 'Users manage own ' || t, t);
  END LOOP;
END $$;
