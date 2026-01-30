-- Founder OS Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  name VARCHAR,
  startup_name VARCHAR,
  stage VARCHAR CHECK (stage IN ('idea', 'building', 'launched', 'revenue')),
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Priorities table
CREATE TABLE public.priorities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Runway entries table
CREATE TABLE public.runway_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cash_balance DECIMAL(15, 2) NOT NULL,
  monthly_burn DECIMAL(15, 2) NOT NULL,
  monthly_revenue DECIMAL(15, 2) DEFAULT 0,
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metric definitions table
CREATE TABLE public.metric_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('currency', 'number', 'percentage')),
  goal DECIMAL(15, 2),
  frequency VARCHAR(20) DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metric entries table
CREATE TABLE public.metric_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_id UUID NOT NULL REFERENCES public.metric_definitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  value DECIMAL(15, 2) NOT NULL,
  logged_at DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline contacts table
CREATE TABLE public.pipeline_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  company VARCHAR(200),
  role VARCHAR(100),
  pipeline_type VARCHAR(20) NOT NULL CHECK (pipeline_type IN ('investor', 'customer', 'hire')),
  stage VARCHAR(50) NOT NULL,
  notes TEXT,
  last_contact_date DATE,
  next_action VARCHAR(500),
  amount DECIMAL(15, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly reflections table
CREATE TABLE public.weekly_reflections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  completed_priorities TEXT[],
  not_done TEXT,
  biggest_risk TEXT,
  next_week_priority TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Indexes for performance
CREATE INDEX idx_priorities_user_date ON public.priorities(user_id, date);
CREATE INDEX idx_priorities_date ON public.priorities(date);
CREATE INDEX idx_runway_user_logged ON public.runway_entries(user_id, logged_at DESC);
CREATE INDEX idx_metric_entries_metric_date ON public.metric_entries(metric_id, logged_at DESC);
CREATE INDEX idx_metric_definitions_user ON public.metric_definitions(user_id);
CREATE INDEX idx_pipeline_user_type ON public.pipeline_contacts(user_id, pipeline_type);
CREATE INDEX idx_pipeline_stage ON public.pipeline_contacts(stage);
CREATE INDEX idx_reflections_user_week ON public.weekly_reflections(user_id, week_start DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_priorities_updated_at
  BEFORE UPDATE ON public.priorities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_updated_at
  BEFORE UPDATE ON public.pipeline_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runway_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Priorities policies
CREATE POLICY "Users can manage own priorities"
  ON public.priorities FOR ALL
  USING (auth.uid() = user_id);

-- Runway policies
CREATE POLICY "Users can manage own runway"
  ON public.runway_entries FOR ALL
  USING (auth.uid() = user_id);

-- Metric definitions policies
CREATE POLICY "Users can manage own metric definitions"
  ON public.metric_definitions FOR ALL
  USING (auth.uid() = user_id);

-- Metric entries policies
CREATE POLICY "Users can manage own metric entries"
  ON public.metric_entries FOR ALL
  USING (auth.uid() = user_id);

-- Pipeline policies
CREATE POLICY "Users can manage own pipeline"
  ON public.pipeline_contacts FOR ALL
  USING (auth.uid() = user_id);

-- Reflections policies
CREATE POLICY "Users can manage own reflections"
  ON public.weekly_reflections FOR ALL
  USING (auth.uid() = user_id);

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
