-- Decisão: tirar a aprovação de conteúdo do admin pra produto novo —
-- produto cadastrado pelo parceiro vai ao ar na hora. Só continua
-- bloqueado por falta de subconta Asaas aprovada quando tem preço
-- (block_priced_promotion_without_asaas, migration 0071 — isso não
-- muda, é sobre dinheiro de verdade, não sobre moderação de conteúdo).
--
-- O trigger continua existindo, mas o papel muda: insert de não-admin
-- agora publica direto como 'approved' (antes forçava 'pending_approval').
-- Update de status continua bloqueado pra não-admin, pra o admin ainda
-- conseguir suspender/rejeitar um produto problemático depois de já
-- publicado.
create or replace function protect_promotions_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.status := 'approved';
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'CANNOT_CHANGE_PROMOTION_STATUS';
  end if;

  return new;
end;
$$;
