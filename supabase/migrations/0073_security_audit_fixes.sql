-- Correções de uma auditoria de segurança:
--
-- 1) protect_partners_privileged_columns não protegia as colunas novas
--    de Asaas (asaas_subaccount_status, asaas_wallet_id,
--    asaas_account_id, asaas_subaccount_error) — RLS permite parceiro
--    dar update na própria linha (partners_update), então qualquer
--    parceiro podia chamar a API direto e se autodeclarar
--    asaas_subaccount_status='approved' sem nunca ter passado pela
--    aprovação real da Asaas, furando o bloqueio de
--    block_priced_promotion_without_asaas. asaas_verified_at fica de
--    fora de propósito — só esconde um aviso visual, não libera nada.
create or replace function protect_partners_privileged_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.approved_at is distinct from old.approved_at
    or new.is_advertiser is distinct from old.is_advertiser
    or new.advertiser_expires_at is distinct from old.advertiser_expires_at
    or new.requires_fee is distinct from old.requires_fee
    or new.asaas_subaccount_status is distinct from old.asaas_subaccount_status
    or new.asaas_wallet_id is distinct from old.asaas_wallet_id
    or new.asaas_account_id is distinct from old.asaas_account_id
    or new.asaas_subaccount_error is distinct from old.asaas_subaccount_error
  then
    raise exception 'CANNOT_CHANGE_PRIVILEGED_FIELD';
  end if;

  return new;
end;
$$;

-- 2) has_mx_record tinha search_path mutável (faltava "set search_path"
--    na criação original) — corrige, sem mudar o comportamento.
create or replace function has_mx_record(p_domain text) returns boolean
language plpgsql set search_path = public as $$
declare
  v_resp extensions.http_response;
  v_body jsonb;
begin
  if p_domain is null or length(trim(p_domain)) = 0 or position('.' in p_domain) = 0 then
    return false;
  end if;
  begin
    select * into v_resp from extensions.http((
      'GET', 'https://dns.google/resolve?type=MX&name=' || p_domain, null, null, null
    )::extensions.http_request);
  exception when others then
    return true;
  end;
  if v_resp is null or v_resp.status <> 200 then
    return true;
  end if;
  begin
    v_body := v_resp.content::jsonb;
  exception when others then
    return true;
  end;
  return coalesce((v_body->>'Status')::int, 1) = 0 and jsonb_array_length(coalesce(v_body->'Answer', '[]'::jsonb)) > 0;
end;
$$;

-- 3) Funções de trigger (nunca deveriam ser chamadas direto via RPC —
--    só disparam sozinhas em INSERT/UPDATE) estavam executáveis por
--    anon/authenticated via /rest/v1/rpc/. Chamar direto só dava erro
--    (NEW/OLD não existem fora de um trigger de verdade), mas fecha a
--    brecha por princípio de menor privilégio.
revoke all on function block_priced_promotion_without_asaas() from public, anon, authenticated;
revoke all on function protect_promotions_status() from public, anon, authenticated;
revoke all on function protect_partners_privileged_columns() from public, anon, authenticated;

-- 4) get_partner_product_orders estava executável por anon (a query
--    interna já filtra por is_partner_staff(), então não vazava dado —
--    mas não devia estar aberta pra quem nem logado está).
revoke all on function get_partner_product_orders(uuid) from public, anon, authenticated;
grant execute on function get_partner_product_orders(uuid) to authenticated;

-- 5) Limpa funções de teste/debug esquecidas no schema de produção
--    (test_trivial_fn, criada durante esta sessão pra isolar um hang de
--    DDL; _ddl_test_fn_old, de antes desta sessão) — nenhuma das duas
--    fazia nada além de `select 1`, mas não deveriam estar aqui.
drop function if exists test_trivial_fn();
drop function if exists _ddl_test_fn_old();
