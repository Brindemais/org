-- ============================================================
-- Achado crítico na auditoria: profiles_update_own (e as políticas
-- equivalentes de partners/products) restringem QUAL LINHA cada um pode
-- editar, mas RLS não restringe COLUNA nenhuma — sem um with_check ou
-- trigger, qualquer assinante logado podia fazer:
--
--   PATCH /rest/v1/profiles?id=eq.<próprio-id>  { "role": "admin" }
--
-- e virar admin sozinho (is_admin() só olha profiles.role). Mesma falha
-- em partners (self-aprovar como anunciante, pular a taxa) e products
-- (parceiro auto-aprovar o próprio produto, pulando a fila do admin).
--
-- Corrige com um trigger BEFORE UPDATE por tabela: deixa o dono da linha
-- mudar seus próprios dados normais (nome, telefone, endereço, foto etc.)
-- mas bloqueia campos que só admin (ou o service_role das Edge Functions,
-- para os campos da Asaas) deveria poder tocar.
-- ============================================================

create or replace function protect_profiles_privileged_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.active is distinct from old.active
    or new.referral_code is distinct from old.referral_code
    or new.referred_by is distinct from old.referred_by
    or new.asaas_customer_id_sandbox is distinct from old.asaas_customer_id_sandbox
    or new.asaas_customer_id_production is distinct from old.asaas_customer_id_production
    or new.asaas_card_token_sandbox is distinct from old.asaas_card_token_sandbox
    or new.asaas_card_token_production is distinct from old.asaas_card_token_production
  then
    raise exception 'CANNOT_CHANGE_PRIVILEGED_FIELD';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profiles_privileged_columns_trigger on profiles;
create trigger protect_profiles_privileged_columns_trigger
before update on profiles
for each row execute function protect_profiles_privileged_columns();

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
  then
    raise exception 'CANNOT_CHANGE_PRIVILEGED_FIELD';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_partners_privileged_columns_trigger on partners;
create trigger protect_partners_privileged_columns_trigger
before update on partners
for each row execute function protect_partners_privileged_columns();

create or replace function protect_products_privileged_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if new.approved is distinct from old.approved then
    raise exception 'CANNOT_CHANGE_PRIVILEGED_FIELD';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_products_privileged_columns_trigger on products;
create trigger protect_products_privileged_columns_trigger
before update on products
for each row execute function protect_products_privileged_columns();
