-- ============================================================
-- Bump the monthly subscription price from R$ 129,90 to R$ 149,90.
--
-- The annual plan keeps the same 20% discount off 12 monthly payments:
-- 149,90 * 12 * 0.8 = 1.439,04 (was 1.247,04 under the old R$ 129,90 price).
--
-- Referral commission: level 2 goes from 1% to 10% (levels 1-2 now both
-- pay 10%, levels 3-7 stay at 1%) — a deliberate push to make the referral
-- payout more attractive early in the chain. Only affects
-- type='subscription' bonuses; the store/consumption branch (dead code,
-- the store was removed from the platform) stays flat 1% as before.
-- ============================================================

create or replace function validate_subscription_payment() returns trigger language plpgsql as $$
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

create or replace function award_referral_bonuses(
  p_source_subscriber_id uuid, p_base_amount numeric, p_type text, p_origin_payment_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_current uuid;
  v_level int := 1;
  v_pct numeric;
  v_amount numeric;
  v_balance numeric;
begin
  select referred_by into v_current from profiles where id = p_source_subscriber_id;

  while v_current is not null and v_level <= 7 loop
    if p_type = 'subscription' then
      v_pct := case when v_level <= 2 then 10.0 else 1.0 end;
    else
      v_pct := 1.0;
    end if;

    v_amount := round(p_base_amount * v_pct / 100.0, 2);

    insert into bonuses (beneficiary_id, source_subscriber_id, type, level, percent, amount, origin_payment_id)
    values (v_current, p_source_subscriber_id, p_type, v_level, v_pct, v_amount, p_origin_payment_id);

    select current_wallet_balance(v_current) + v_amount into v_balance;

    insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
    values (
      v_current,
      (case when p_type = 'subscription' then 'bonus_subscription' else 'bonus_consumption' end)::wallet_tx_type,
      'in', v_amount, v_balance, 'payment', p_origin_payment_id,
      'Bonificação nível ' || v_level || ' (' || v_pct || '%) - ' || case when p_type='subscription' then 'assinatura' else 'consumo' end
    );

    insert into notifications (user_id, type, title, message)
    values (v_current, 'bonus', 'Nova bonificação recebida', 'Você recebeu R$ ' || v_amount || ' de bonificação (nível ' || v_level || ').');

    select referred_by into v_current from profiles where id = v_current;
    v_level := v_level + 1;
  end loop;
end;
$$;
