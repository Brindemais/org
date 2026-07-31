-- Every table in public has RLS policies defined (0003_rls.sql) but was
-- missing the underlying Postgres GRANTs that PostgREST's anon/authenticated
-- roles need before RLS is even evaluated. Without this, every query and
-- mutation from the app fails with "permission denied for table ..." — RLS
-- policies alone are not sufficient; both layers are required.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- Keep future tables/sequences/functions covered automatically.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
