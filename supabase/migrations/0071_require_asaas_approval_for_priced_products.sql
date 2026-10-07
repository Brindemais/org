-- Torna obrigatório ter a subconta Asaas APROVADA (não só criada) antes
-- de poder cadastrar um produto com preço — garante que todo repasse é
-- de verdade, sem saldo fictício na carteira interna enquanto a
-- verificação (KYC) ainda não foi concluída pela Asaas.
alter table partners drop constraint if exists partners_asaas_subaccount_status_check;
alter table partners add constraint partners_asaas_subaccount_status_check
  check (asaas_subaccount_status in ('pending','created','approved','rejected','failed'));

create or replace function block_priced_promotion_without_asaas() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if coalesce(new.subscriber_price, 0) <= 0 then
    return new;
  end if;

  select asaas_subaccount_status into v_status from partners where id = new.partner_id;
  if v_status is distinct from 'approved' then
    raise exception 'ASAAS_SUBACCOUNT_NOT_APPROVED';
  end if;

  return new;
end;
$$;

drop trigger if exists block_priced_promotion_without_asaas_trigger on promotions;
create trigger block_priced_promotion_without_asaas_trigger
before insert or update of subscriber_price, partner_id on promotions
for each row execute function block_priced_promotion_without_asaas();
