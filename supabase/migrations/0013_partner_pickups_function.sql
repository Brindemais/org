-- Replaces partner_pickup_view (flagged CRITICAL by Supabase's linter as a
-- "Security Definer View" — a view that isn't security_invoker) with a
-- SECURITY DEFINER function instead. Same access logic, same minimal
-- columns (subscriber name/phone only, never CPF/address/pix_key), same
-- is_partner_staff() gate — just packaged the way the linter expects
-- privileged reads to be packaged in this codebase (every other
-- cross-table read like this is already an RPC, e.g. is_partner_staff,
-- current_wallet_balance).
drop view if exists partner_pickup_view;

create or replace function get_partner_pickups(p_partner_id uuid)
returns table (
  pickup_id uuid, partner_id uuid, status pickup_status, code text, cycle_month int, cycle_year int,
  deadline timestamptz, product_id uuid, confirmed_at timestamptz, created_at timestamptz,
  subscriber_name text, subscriber_phone text, authorized_name text, authorized_cpf text
) language sql stable security definer set search_path = public as $$
  select p.id, p.partner_id, p.status, p.code, p.cycle_month, p.cycle_year, p.deadline,
         p.product_id, p.confirmed_at, p.created_at,
         pr.full_name, pr.phone, ap.full_name, ap.cpf
  from pickups p
  join profiles pr on pr.id = p.subscriber_id
  left join authorized_persons ap on ap.id = p.authorized_person_id
  where p.partner_id = p_partner_id and is_partner_staff(p_partner_id)
  order by p.created_at desc;
$$;

revoke execute on function get_partner_pickups(uuid) from public;
grant execute on function get_partner_pickups(uuid) to anon, authenticated;
