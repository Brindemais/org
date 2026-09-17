-- ============================================================
-- Auditoria: partners_public e products_public (0033) foram criadas
-- como VIEW comum, que por padrão roda com o privilégio de quem criou
-- a view (bypassa RLS de quem está consultando) — é exatamente essa
-- mecânica que o linter de segurança do Supabase sinaliza como ERROR
-- "Security Definer View". Este projeto já tinha resolvido esse mesmo
-- problema antes (ver 0013_partner_pickups_function.sql, que trocou
-- partner_pickup_view por get_partner_pickups por esse motivo exato)
-- — troca as duas views pelo mesmo padrão: função SECURITY DEFINER
-- com STABLE, que o PostgREST trata como uma tabela pra fins de
-- filtro/paginação (.eq(), .limit(), .maybeSingle() continuam
-- funcionando do lado do app sem mudar a forma de chamar).
-- ============================================================

drop view if exists partners_public;
drop view if exists products_public;

create or replace function list_public_partners()
returns table (
  id uuid, trade_name text, category text, neighborhood text, city text, state text,
  address text, opening_hours text, logo_url text, whatsapp text, lat numeric, lng numeric,
  status partner_status, rating numeric
) language sql stable security definer set search_path = public as $$
  select id, trade_name, category, neighborhood, city, state, address, opening_hours, logo_url, whatsapp, lat, lng, status, rating
  from partners
  where status in ('approved', 'active');
$$;

revoke execute on function list_public_partners() from public;
grant execute on function list_public_partners() to anon, authenticated;

create or replace function list_public_products()
returns table (
  id uuid, partner_id uuid, name text, description text, image_url text, category text,
  normal_price numeric, subscriber_price numeric, is_gift boolean, store_visible boolean,
  active boolean, approved boolean, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select id, partner_id, name, description, image_url, category, normal_price, subscriber_price, is_gift, store_visible, active, approved, created_at
  from products
  where active = true and approved = true;
$$;

revoke execute on function list_public_products() from public;
grant execute on function list_public_products() to anon, authenticated;

-- Índice de FK que ficou faltando na taxa de anunciante (0035).
create index if not exists payments_partner_id_idx on payments(partner_id);
