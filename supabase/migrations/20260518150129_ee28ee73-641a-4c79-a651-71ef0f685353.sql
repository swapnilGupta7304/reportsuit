
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE public.project_type AS ENUM ('website', 'app', 'both');
CREATE TYPE public.project_status AS ENUM ('active', 'archived');
CREATE TYPE public.integration_provider AS ENUM ('ga4', 'firebase', 'play_console');
CREATE TYPE public.integration_status AS ENUM ('connected', 'disconnected', 'error');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORGANIZATION MEMBERS
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id UUID, _user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org_id AND user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_org_min_role(_org_id UUID, _user_id UUID, _min_role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id
      AND (
        (_min_role = 'viewer') OR
        (_min_role = 'editor' AND role IN ('editor','admin')) OR
        (_min_role = 'admin' AND role = 'admin')
      )
  );
$$;

-- Organizations policies
CREATE POLICY "orgs_select_members" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "orgs_insert_any" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "orgs_update_admin" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), 'admin'));
CREATE POLICY "orgs_delete_admin" ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), 'admin'));

-- Organization members policies
CREATE POLICY "org_members_select" ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org_members_insert_admin" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'admin')
    OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = organization_members.organization_id)
  );
CREATE POLICY "org_members_update_admin" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY "org_members_delete_admin" ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin') OR user_id = auth.uid());

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_type public.project_type NOT NULL DEFAULT 'website',
  status public.project_status NOT NULL DEFAULT 'active',
  website_url TEXT,
  icon_url TEXT,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_projects_org ON public.projects(organization_id);
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_org_min_role(organization_id, auth.uid(), 'editor') AND created_by = auth.uid());
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
  USING (public.has_org_min_role(organization_id, auth.uid(), 'editor'));
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- INTEGRATIONS
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  account_label TEXT,
  refresh_token_secret_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_integrations_org ON public.integrations(organization_id);
CREATE TRIGGER integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "integrations_select" ON public.integrations FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "integrations_write_editor" ON public.integrations FOR ALL TO authenticated
  USING (public.has_org_min_role(organization_id, auth.uid(), 'editor'))
  WITH CHECK (public.has_org_min_role(organization_id, auth.uid(), 'editor'));

-- GA4 properties / Firebase apps / Play apps (each links project -> integration)
CREATE TABLE public.ga4_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL,
  property_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ga4_properties ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ga4_project ON public.ga4_properties(project_id);

CREATE TABLE public.firebase_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  firebase_app_id TEXT NOT NULL,
  app_name TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.firebase_apps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_firebase_project ON public.firebase_apps(project_id);

CREATE TABLE public.play_console_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  app_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.play_console_apps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_play_project ON public.play_console_apps(project_id);

-- Reusable project-scoped RLS predicate
CREATE OR REPLACE FUNCTION public.project_visible(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND public.is_org_member(p.organization_id, _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.project_writable(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND public.has_org_min_role(p.organization_id, _user_id, 'editor')
  );
$$;

-- Generic policies for the three property tables
CREATE POLICY "ga4_select" ON public.ga4_properties FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "ga4_write" ON public.ga4_properties FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));
CREATE POLICY "firebase_select" ON public.firebase_apps FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "firebase_write" ON public.firebase_apps FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));
CREATE POLICY "play_select" ON public.play_console_apps FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "play_write" ON public.play_console_apps FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- ANALYTICS SNAPSHOTS (one row per project per day per source)
CREATE TABLE public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source public.integration_provider NOT NULL,
  snapshot_date DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, source, snapshot_date)
);
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_snapshots_project_date ON public.analytics_snapshots(project_id, snapshot_date DESC);
CREATE POLICY "snapshots_select" ON public.analytics_snapshots FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "snapshots_write" ON public.analytics_snapshots FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- WEBSITE METRICS (daily KPI row)
CREATE TABLE public.website_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  total_users INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  returning_users INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  bounce_rate NUMERIC NOT NULL DEFAULT 0,
  engagement_rate NUMERIC NOT NULL DEFAULT 0,
  avg_engagement_time NUMERIC NOT NULL DEFAULT 0,
  organic_traffic INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, metric_date)
);
ALTER TABLE public.website_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wm_project_date ON public.website_metrics(project_id, metric_date DESC);
CREATE POLICY "wm_select" ON public.website_metrics FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "wm_write" ON public.website_metrics FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- TRAFFIC SOURCES
CREATE TABLE public.traffic_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  source TEXT NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  engaged_sessions INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC NOT NULL DEFAULT 0,
  avg_engagement_time_per_session NUMERIC NOT NULL DEFAULT 0,
  bounce_rate NUMERIC NOT NULL DEFAULT 0,
  events_per_session NUMERIC NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.traffic_sources ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ts_project_date ON public.traffic_sources(project_id, metric_date DESC);
CREATE POLICY "ts_select" ON public.traffic_sources FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "ts_write" ON public.traffic_sources FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- TOP PAGES
CREATE TABLE public.top_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  page_path TEXT NOT NULL,
  pageviews INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  returning_users INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  bounce_rate NUMERIC NOT NULL DEFAULT 0,
  engagement_rate NUMERIC NOT NULL DEFAULT 0,
  avg_engagement_time NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.top_pages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tp_project_date ON public.top_pages(project_id, metric_date DESC);
CREATE POLICY "tp_select" ON public.top_pages FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "tp_write" ON public.top_pages FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- GEOGRAPHY
CREATE TABLE public.geography (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  country TEXT,
  country_code TEXT,
  city TEXT,
  users INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.geography ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_geo_project_date ON public.geography(project_id, metric_date DESC);
CREATE POLICY "geo_select" ON public.geography FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "geo_write" ON public.geography FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- DEVICES
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  device_category TEXT,
  operating_system TEXT,
  active_users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  engaged_sessions INTEGER NOT NULL DEFAULT 0,
  bounce_rate NUMERIC NOT NULL DEFAULT 0,
  avg_engagement_time NUMERIC NOT NULL DEFAULT 0,
  engagement_rate NUMERIC NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dev_project_date ON public.devices(project_id, metric_date DESC);
CREATE POLICY "dev_select" ON public.devices FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "dev_write" ON public.devices FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  event_name TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ev_project_date ON public.events(project_id, metric_date DESC);
CREATE POLICY "ev_select" ON public.events FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "ev_write" ON public.events FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- APP METRICS
CREATE TABLE public.app_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  installs INTEGER NOT NULL DEFAULT 0,
  uninstalls INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  dau INTEGER NOT NULL DEFAULT 0,
  mau INTEGER NOT NULL DEFAULT 0,
  retention_rate NUMERIC NOT NULL DEFAULT 0,
  crash_rate NUMERIC NOT NULL DEFAULT 0,
  anr_rate NUMERIC NOT NULL DEFAULT 0,
  avg_rating NUMERIC NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  store_visitors INTEGER NOT NULL DEFAULT 0,
  install_conversion_rate NUMERIC NOT NULL DEFAULT 0,
  organic_installs INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, metric_date)
);
ALTER TABLE public.app_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_am_project_date ON public.app_metrics(project_id, metric_date DESC);
CREATE POLICY "am_select" ON public.app_metrics FOR SELECT TO authenticated USING (public.project_visible(project_id, auth.uid()));
CREATE POLICY "am_write" ON public.app_metrics FOR ALL TO authenticated USING (public.project_writable(project_id, auth.uid())) WITH CHECK (public.project_writable(project_id, auth.uid()));

-- Auto-create profile + default org on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id UUID;
  base_slug TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  base_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]+', '-', 'g')) || '-' || substr(NEW.id::text, 1, 6);
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES ('My Organization', base_slug, NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin');

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
