-- 0006_grants.sql granted EXECUTE on ALL public functions to anon/authenticated
-- so the app's own RPC calls (complete_signup, request_withdrawal, etc.) would
-- work — those all self-check is_admin()/is_partner_staff()/auth.uid() internally.
--
-- These three don't: they're batch maintenance sweeps meant to run on a
-- schedule (cron / service_role), not be called by end users. Left publicly
-- executable, any anon visitor could hit them via /rest/v1/rpc/... and force
-- other users' subscriptions/pickups into overdue/suspended/expired ahead of
-- schedule. Restrict to admin (or run them via service_role from a cron job).
-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default when a
-- function is created (unlike tables, which default to no access) — so
-- revoking from anon/authenticated alone leaves them executable via the
-- standing PUBLIC grant. Must revoke from PUBLIC explicitly.
revoke execute on function expire_overdue_pickups() from public;
revoke execute on function expire_overdue_subscriptions() from public;
revoke execute on function run_daily_expirations() from public;

-- Trigger/event-trigger functions can't be invoked directly via RPC anyway
-- (Postgres rejects a manual call), but revoke for hygiene/defense-in-depth.
revoke execute on function products_force_approval() from public;
revoke execute on function rls_auto_enable() from public;
