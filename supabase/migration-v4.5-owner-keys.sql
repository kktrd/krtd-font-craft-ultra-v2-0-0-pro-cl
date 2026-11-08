-- ================================================================
-- KRTD Font Craft — Migration v4.5 : per-owner projects + safer RLS
-- For an EXISTING database. Run in Supabase → SQL Editor.
-- (A fresh database can just run fontcraft-db-schema.sql, which already has this.)
--
-- WHY
--   * font_name was UNIQUE for the whole table, so two users (or two guests) who
--     used the same font name overwrote each other / got blocked.
--   * Every guest shared the single owner id 'guest' (any visitor could touch any
--     guest row). Guests now get a per-device owner id  g:<random uuid>.
--   * user_roles / admin policies queried user_roles inside their own policy
--     (infinite recursion) and admins could not see other users' projects.
--
-- HOW — two steps, in this order:
--   STEP 1  (run NOW — additive, safe with the currently deployed app)
--   deploy app v4.5.0 (GitHub → Vercel) and open the site once
--   STEP 2  (run AFTER v4.5.0 is live — removes the old permissive rules)
-- Both steps can be re-run safely.
-- ================================================================


-- ################################################################
-- STEP 1 — additive only
-- ################################################################

-- Admin helpers (SECURITY DEFINER = no policy recursion)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = (select auth.uid())::text AND role IN ('admin','super_admin'));
$$;
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = (select auth.uid())::text AND role = 'super_admin');
$$;
REVOKE ALL ON FUNCTION public.is_admin(), public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.is_super_admin() TO anon, authenticated;

-- user_roles: replace the self-referencing (recursive) policies
DROP POLICY IF EXISTS "admin_read_roles"   ON public.user_roles;
DROP POLICY IF EXISTS "admin_manage_roles" ON public.user_roles;
DROP POLICY IF EXISTS "own_role_read"      ON public.user_roles;
CREATE POLICY "own_role_read"      ON public.user_roles FOR SELECT USING (user_id = (select auth.uid())::text);
CREATE POLICY "admin_read_roles"   ON public.user_roles FOR SELECT USING (public.is_admin());
CREATE POLICY "admin_manage_roles" ON public.user_roles FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Admin dashboard can see everything; only super admins can change / delete others' data
DROP POLICY IF EXISTS "admin_read_projects"  ON public.font_projects;
DROP POLICY IF EXISTS "super_manage_projects" ON public.font_projects;
DROP POLICY IF EXISTS "admin_read_history"   ON public.glyph_history;
CREATE POLICY "admin_read_projects"   ON public.font_projects FOR SELECT USING (public.is_admin());
CREATE POLICY "super_manage_projects" ON public.font_projects FOR ALL
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "admin_read_history"    ON public.glyph_history FOR SELECT USING (public.is_admin());

-- New uniqueness (owner + name). The old font_name-only constraint stays until STEP 2.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fp_owner_name ON public.font_projects (user_id, font_name);

-- NEW owner rules, added NEXT TO the old ones (policies are OR-ed, so nothing breaks).
-- STEP 2 removes the old, too-permissive policies.
DROP POLICY IF EXISTS "own_rows"          ON public.font_projects;
DROP POLICY IF EXISTS "device_guest_rows" ON public.font_projects;
DROP POLICY IF EXISTS "legacy_guest_read" ON public.font_projects;
CREATE POLICY "own_rows" ON public.font_projects FOR ALL TO authenticated
  USING ((select auth.uid())::text = user_id) WITH CHECK ((select auth.uid())::text = user_id);
CREATE POLICY "device_guest_rows" ON public.font_projects FOR ALL TO anon, authenticated
  USING      (user_id LIKE 'g:%' AND length(user_id) >= 34)
  WITH CHECK (user_id LIKE 'g:%' AND length(user_id) >= 34);
-- old shared 'guest' rows: read-only (after STEP 2) so the app can copy them to the new owner id
CREATE POLICY "legacy_guest_read" ON public.font_projects FOR SELECT TO anon, authenticated
  USING (user_id = 'guest');

DROP POLICY IF EXISTS "history_read_owner"   ON public.glyph_history;
DROP POLICY IF EXISTS "history_insert_owner" ON public.glyph_history;
CREATE POLICY "history_read_owner" ON public.glyph_history FOR SELECT USING (
  user_id = (select auth.uid())::text
  OR (user_id LIKE 'g:%' AND length(user_id) >= 34)
  OR user_id = 'guest'
  OR EXISTS (SELECT 1 FROM public.font_projects fp
             WHERE fp.font_name = glyph_history.font_name AND fp.is_public = true)
);
CREATE POLICY "history_insert_owner" ON public.glyph_history FOR INSERT WITH CHECK (
  (user_id = (select auth.uid())::text OR (user_id LIKE 'g:%' AND length(user_id) >= 34))
  AND EXISTS (SELECT 1 FROM public.font_projects fp
              WHERE fp.font_name = glyph_history.font_name AND fp.user_id = glyph_history.user_id)
);

-- Function hardening (v4.5): fixed search_path; table-size RPC only for signed-in users
ALTER FUNCTION public.get_table_sizes() SET search_path = public;
ALTER FUNCTION public.get_user_role(text) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_table_sizes() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_table_sizes() TO authenticated;


-- ################################################################
-- STEP 2 — run AFTER app v4.5.0 is deployed and you opened the site once
--          (removes the old rules that let every guest share one owner)
-- ################################################################

-- Same font name may now exist once per owner
ALTER TABLE public.font_projects DROP CONSTRAINT IF EXISTS font_projects_font_name_key;

-- old, too-permissive policies
DROP POLICY IF EXISTS "auth_manage_own" ON public.font_projects;   -- (owner OR user_id='guest')
DROP POLICY IF EXISTS "guest_insert"    ON public.font_projects;   -- (user_id='guest')
DROP POLICY IF EXISTS "history_read"    ON public.glyph_history;
DROP POLICY IF EXISTS "history_insert"  ON public.glyph_history;

-- OPTIONAL — give an old shared guest project to a signed-in user (replace both values):
-- UPDATE public.font_projects SET user_id = 'YOUR-AUTH-UUID'
--  WHERE user_id = 'guest' AND font_name = 'YOUR-FONT-NAME'
--    AND NOT EXISTS (SELECT 1 FROM public.font_projects x
--                    WHERE x.user_id = 'YOUR-AUTH-UUID' AND x.font_name = 'YOUR-FONT-NAME');
