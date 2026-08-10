-- ============================================================
-- service_role (the key Edge Functions use for privileged access,
-- bypassing RLS) had no SELECT/INSERT/UPDATE/DELETE on ANY table in
-- public — only REFERENCES/TRIGGER/TRUNCATE, checked across every table.
-- Nothing hit this until now because every existing Edge Function routes
-- writes through SECURITY DEFINER RPCs (which run as the function owner,
-- not the caller), never a direct .from() call — notify-renewal-reminders
-- is the first to do that and immediately failed with "permission denied
-- for table subscriptions". Restoring the standard Supabase default.
-- ============================================================
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
