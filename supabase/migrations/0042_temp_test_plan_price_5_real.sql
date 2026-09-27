-- Ajuste do teste real (migração 0041): a Asaas recusou R$ 1,00 com
-- "valor mínimo de cobrança é R$ 5,00" (invalid_object). Sobe pra R$ 5,00.
create or replace function validate_subscription_payment() returns trigger language plpgsql set search_path = public as $$
begin
  if new.type = 'subscription' then
    if new.plan is null then
      new.plan := 'monthly';
    end if;
    if new.plan = 'monthly' and new.amount <> 5.00 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
    if new.plan = 'annual' and new.amount <> 5.00 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
  end if;
  return new;
end;
$$;
