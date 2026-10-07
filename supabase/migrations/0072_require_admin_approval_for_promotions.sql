-- Produto/promoção cadastrado pelo parceiro passa a entrar em fila de
-- aprovação (admin/Promotions.tsx já tinha a tela pronta pra isso, só
-- não era usada — o front publicava direto como 'approved'). Trigger
-- força isso no banco também: parceiro nunca consegue inserir com
-- status != 'pending_approval' nem mudar o status depois (só admin, via
-- admin_set_promotion_status) — fecha a brecha de alguém mandar
-- status='approved' direto pela API sem passar pela tela do front.
create or replace function protect_promotions_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.status := 'pending_approval';
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'CANNOT_CHANGE_PROMOTION_STATUS';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_promotions_status_trigger on promotions;
create trigger protect_promotions_status_trigger
before insert or update on promotions
for each row execute function protect_promotions_status();
