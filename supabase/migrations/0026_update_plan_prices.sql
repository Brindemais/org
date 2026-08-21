-- ============================================================
-- Bump the monthly subscription price from R$ 99,90 to R$ 129,90.
--
-- The annual plan keeps the same 20% discount off 12 monthly payments:
-- 129,90 * 12 * 0.8 = 1.247,04 (was 959,04 under the old R$ 99,90 price).
-- ============================================================

create or replace function validate_subscription_payment() returns trigger language plpgsql as $$
begin
  if new.type = 'subscription' then
    if new.plan is null then
      new.plan := 'monthly';
    end if;
    if new.plan = 'monthly' and new.amount <> 129.90 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
    if new.plan = 'annual' and new.amount <> 1247.04 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
  end if;
  return new;
end;
$$;
