-- Reverte o teste real em produção (migrações 0041/0042) de volta pros
-- valores reais: mensal R$ 149,90 / anual R$ 1.439,04.
create or replace function validate_subscription_payment() returns trigger language plpgsql set search_path = public as $$
begin
  if new.type = 'subscription' then
    if new.plan is null then
      new.plan := 'monthly';
    end if;
    if new.plan = 'monthly' and new.amount <> 149.90 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
    if new.plan = 'annual' and new.amount <> 1439.04 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
  end if;
  return new;
end;
$$;
