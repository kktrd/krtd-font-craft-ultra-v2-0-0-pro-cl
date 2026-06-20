-- ================================================================
-- KRTD Font Craft Ultra v2.0.0 PRO — Supabase Schema
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL)
-- ================================================================

-- 1. FONT PROJECTS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.font_projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  font_name   text        UNIQUE NOT NULL,
  user_id     text        NOT NULL DEFAULT 'guest',
  role        text        NOT NULL DEFAULT 'designer'
                          CHECK (role IN ('guest','designer','admin')),
  metrics     jsonb       NOT NULL DEFAULT '{}',
  glyphs      jsonb       NOT NULL DEFAULT '{}',
  is_public   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. AUDIT LOG TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigserial   PRIMARY KEY,
  user_id     text,
  action      text        NOT NULL,
  target      text,
  metadata    jsonb       DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. USER ROLES TABLE (super admin management)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        UNIQUE NOT NULL,
  role        text        NOT NULL DEFAULT 'designer'
                          CHECK (role IN ('guest','designer','admin','super_admin')),
  granted_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. INDEXES
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_fp_user_id   ON public.font_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_fp_updated   ON public.font_projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_fp_public    ON public.font_projects(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_audit_user   ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts     ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roles_user   ON public.user_roles(user_id);

-- 5. UPDATED_AT TRIGGER
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_fp_updated_at ON public.font_projects;
CREATE TRIGGER trg_fp_updated_at
  BEFORE UPDATE ON public.font_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. ROW LEVEL SECURITY
-- ----------------------------------------------------------------
ALTER TABLE public.font_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles    ENABLE ROW LEVEL SECURITY;

-- Drop existing policies cleanly before recreating
DROP POLICY IF EXISTS "public_read_public"     ON public.font_projects;
DROP POLICY IF EXISTS "auth_manage_own"        ON public.font_projects;
DROP POLICY IF EXISTS "guest_insert"           ON public.font_projects;
DROP POLICY IF EXISTS "auth_insert_audit"      ON public.audit_log;
DROP POLICY IF EXISTS "auth_read_own_audit"    ON public.audit_log;
DROP POLICY IF EXISTS "admin_read_roles"       ON public.user_roles;
DROP POLICY IF EXISTS "admin_manage_roles"     ON public.user_roles;

-- font_projects policies
CREATE POLICY "public_read_public" ON public.font_projects
  FOR SELECT USING (is_public = true);

CREATE POLICY "auth_manage_own" ON public.font_projects
  FOR ALL USING (
    auth.uid()::text = user_id
    OR user_id = 'guest'
  );

CREATE POLICY "guest_insert" ON public.font_projects
  FOR INSERT WITH CHECK (user_id = 'guest');

-- audit_log policies
CREATE POLICY "auth_insert_audit" ON public.audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "auth_read_own_audit" ON public.audit_log
  FOR SELECT USING (auth.uid()::text = user_id);

-- user_roles policies (only admins can read/manage)
CREATE POLICY "admin_read_roles" ON public.user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
      AND ur.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "admin_manage_roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()::text
      AND ur.role = 'super_admin'
    )
  );

-- 7. HELPER FUNCTION — get current user role
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1),
    'designer'
  );
$$;

-- 8. SEED SUPER ADMIN (replace with your Supabase auth user UUID)
-- ----------------------------------------------------------------
-- INSERT INTO public.user_roles (user_id, role, granted_by)
-- VALUES ('YOUR-SUPABASE-USER-UUID-HERE', 'super_admin', 'system')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- 9. LIVE TABLE SIZE RPC (used by Admin Metrics view)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE(table_name text, total_size text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    relname::text AS table_name,
    pg_size_pretty(pg_total_relation_size(relid))::text AS total_size
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(relid) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO authenticated;

-- ================================================================
-- SUPER ADMIN SETUP — Run AFTER confirming email in Supabase Auth
-- ================================================================
-- Step 1: Go to Supabase → Authentication → Users
--         Click "Add User" → enter your email + password → Confirm
-- Step 2: Get your UUID from the Users list
-- Step 3: Replace 'YOUR-UUID-HERE' below and run:

-- INSERT INTO public.user_roles (user_id, role, granted_by)
-- VALUES ('YOUR-UUID-HERE', 'super_admin', 'system')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- To verify:
-- SELECT * FROM public.user_roles WHERE role = 'super_admin';
-- ================================================================

-- ================================================================
-- GLYPH VERSION HISTORY — Time-travel / restore per character
-- ================================================================
CREATE TABLE IF NOT EXISTS public.glyph_history (
  id            bigserial   PRIMARY KEY,
  font_name     text        NOT NULL,
  glyph_char    text        NOT NULL,
  strokes       jsonb       NOT NULL,
  stroke_count  int         NOT NULL DEFAULT 0,
  label         text,
  user_id       text        NOT NULL DEFAULT 'guest',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glyph_history_lookup
  ON public.glyph_history(font_name, glyph_char, created_at DESC);

ALTER TABLE public.glyph_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_manage_history" ON public.glyph_history;
CREATE POLICY "anyone_manage_history" ON public.glyph_history
  FOR ALL USING (true) WITH CHECK (true);

-- Optional housekeeping: keep only the latest 20 snapshots per (font_name, glyph_char).
-- Run manually or schedule via Supabase Cron if the table grows large:
--
-- DELETE FROM public.glyph_history a
-- WHERE a.id NOT IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (
--       PARTITION BY font_name, glyph_char ORDER BY created_at DESC
--     ) AS rn
--     FROM public.glyph_history
--   ) ranked WHERE rn <= 20
-- );
