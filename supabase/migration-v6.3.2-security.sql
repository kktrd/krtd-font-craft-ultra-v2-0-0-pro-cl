-- KRTD v6.3.2 — security hardening (run AFTER the v6.3.2 client is deployed; idempotent).
-- 1) Guest rows are bound to the caller's own device header (x-krtd-device), not "any g:* row".
-- 2) Admin policies apply to signed-in users only; helper functions no longer callable by anon.
-- 3) audit_log: no spoofed authors, bounded size, append-only. 4) Least-privilege table grants.
-- 5) Storage quotas (row size + rows per owner) so nobody can fill the free database.

create or replace function public.krtd_device() returns text
language sql stable set search_path = public as $$
  select nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-krtd-device', '')
$$;
grant execute on function public.krtd_device() to anon, authenticated;

-- ---- font_projects ----
drop policy if exists device_guest_rows on public.font_projects;
create policy device_guest_rows on public.font_projects for all to anon, authenticated
  using (user_id like 'g:%' and length(user_id) >= 34 and user_id = public.krtd_device())
  with check (user_id like 'g:%' and length(user_id) >= 34 and user_id = public.krtd_device());

drop policy if exists admin_read_projects on public.font_projects;
create policy admin_read_projects on public.font_projects for select to authenticated using (public.is_admin());
drop policy if exists super_manage_projects on public.font_projects;
create policy super_manage_projects on public.font_projects for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ---- glyph_history ----
drop policy if exists history_insert_owner on public.glyph_history;
create policy history_insert_owner on public.glyph_history for insert to anon, authenticated
  with check ((user_id = (select auth.uid())::text or (user_id like 'g:%' and length(user_id) >= 34 and user_id = public.krtd_device()))
    and exists (select 1 from public.font_projects fp where fp.font_name = glyph_history.font_name and fp.user_id = glyph_history.user_id));
drop policy if exists history_read_owner on public.glyph_history;
create policy history_read_owner on public.glyph_history for select to anon, authenticated
  using (user_id = (select auth.uid())::text
    or (user_id like 'g:%' and user_id = public.krtd_device())
    or user_id = 'guest'
    or exists (select 1 from public.font_projects fp where fp.font_name = glyph_history.font_name and fp.user_id = glyph_history.user_id and fp.is_public = true));
drop policy if exists admin_read_history on public.glyph_history;
create policy admin_read_history on public.glyph_history for select to authenticated using (public.is_admin());

-- ---- user_roles ----
drop policy if exists admin_manage_roles on public.user_roles;
create policy admin_manage_roles on public.user_roles for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists admin_read_roles on public.user_roles;
create policy admin_read_roles on public.user_roles for select to authenticated using (public.is_admin());
drop policy if exists own_role_read on public.user_roles;
create policy own_role_read on public.user_roles for select to authenticated using (user_id = (select auth.uid())::text);

-- ---- audit_log ----
drop policy if exists auth_insert_audit on public.audit_log;
create policy auth_insert_audit on public.audit_log for insert to authenticated
  with check (user_id = (select auth.uid())::text);
drop policy if exists auth_read_own_audit on public.audit_log;
create policy auth_read_own_audit on public.audit_log for select to authenticated
  using (user_id = (select auth.uid())::text or public.is_admin());
alter table public.audit_log drop constraint if exists audit_log_size_chk;
alter table public.audit_log add constraint audit_log_size_chk check (
  length(coalesce(action, '')) <= 64 and length(coalesce(target, '')) <= 300 and pg_column_size(metadata) <= 4096) not valid;

-- ---- functions ----
create or replace function public.get_table_sizes() returns table(table_name text, total_size text)
language sql stable security definer set search_path = public as $$
  select relname::text, pg_size_pretty(pg_total_relation_size(relid))::text
  from pg_stat_user_tables where schemaname = 'public' and public.is_admin()
  order by pg_total_relation_size(relid) desc;
$$;
revoke execute on function public.is_admin(), public.is_super_admin(), public.get_table_sizes(), public.get_user_role(text) from public, anon;
grant execute on function public.is_admin(), public.is_super_admin(), public.get_table_sizes(), public.get_user_role(text) to authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ---- least-privilege grants ----
revoke truncate, trigger, references on public.audit_log, public.font_projects, public.glyph_history, public.user_roles from anon, authenticated;
revoke all on public.user_roles from anon;
revoke all on public.audit_log from anon;
revoke update, delete on public.audit_log from authenticated;

-- ---- quotas ----
create or replace function public.krtd_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if tg_table_name = 'font_projects' then
    if pg_column_size(new.glyphs) + pg_column_size(new.metrics) + coalesce(pg_column_size(new.settings), 0) > 6291456 then
      raise exception 'project too large (max 6 MB)' using errcode = '54000';
    end if;
    if tg_op = 'INSERT' and not public.is_admin() then
      select count(*) into n from public.font_projects where user_id = new.user_id;
      if n >= 60 then raise exception 'too many projects (max 60)' using errcode = '54000'; end if;
    end if;
  elsif tg_table_name = 'glyph_history' then
    if pg_column_size(new.strokes) > 524288 or length(coalesce(new.label, '')) > 200 then
      raise exception 'history entry too large' using errcode = '54000';
    end if;
    if tg_op = 'INSERT' then
      select count(*) into n from public.glyph_history where user_id = new.user_id;
      if n >= 5000 then raise exception 'history quota reached' using errcode = '54000'; end if;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.krtd_quota() from public, anon, authenticated;
drop trigger if exists krtd_quota_fp on public.font_projects;
create trigger krtd_quota_fp before insert or update on public.font_projects for each row execute function public.krtd_quota();
drop trigger if exists krtd_quota_gh on public.glyph_history;
create trigger krtd_quota_gh before insert or update on public.glyph_history for each row execute function public.krtd_quota();
