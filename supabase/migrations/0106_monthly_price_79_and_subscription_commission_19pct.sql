-- Pedido do dono:
-- 1) Assinatura mensal de R$149,90 para R$79,00 (anual NÃO mexido aqui —
--    ver nota abaixo, precisa de confirmação separada por causa da
--    inconsistência que isso cria com o valor anual atual).
-- 2) Comissão de indicação de ASSINATURA (bonus_subscription) sobe de
--    10%/10%/1%/1% (níveis 1-4) para 19%/19%/1%/1%. A comissão de
--    indicação de PARCEIRO (bonus_partner_fee, taxa de anunciante) NÃO
--    foi mencionada e continua 10%/10%/1%/1% — por isso a função precisou
--    separar os dois tipos, que antes compartilhavam o mesmo cálculo.
--
-- NOTA sobre o plano anual: ele é R$1.439,04 hoje, calculado como
-- 149,90 × 12 × 0,8 (20% de desconto) — migração 0028. Com o mensal caindo
-- pra R$79, manter o anual em R$1.439,04 faz ele custar MAIS que pagar o
-- mensal 12 vezes (948 vs 1.439,04), o que não faz sentido comercial.
-- Deixado como está até confirmação do valor correto.
create or replace function public.validate_subscription_payment()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.type = 'subscription' then
    if new.plan is null then
      new.plan := 'monthly';
    end if;
    if new.plan = 'monthly' and new.amount <> 79.00 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
    if new.plan = 'annual' and new.amount <> 1439.04 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
  elsif new.type = 'partner_fee' and new.amount <> 149.90 then
    raise exception 'INVALID_PLAN_AMOUNT';
  end if;
  return new;
end;
$function$;

create or replace function public.pay_subscription_wallet(p_plan text)
 returns payments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_amount numeric;
  v_sub subscriptions;
  v_payment payments;
  v_available numeric;
  v_interval interval;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if p_plan not in ('monthly', 'annual') then
    raise exception 'INVALID_PLAN';
  end if;

  v_amount := case p_plan when 'annual' then 1439.04 else 79.00 end;

  select available_balance(auth.uid()) into v_available;
  if coalesce(v_available, 0) < v_amount then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into payments (subscriber_id, amount, plan, type, payment_method, status, confirmed_at, confirmed_by)
  values (auth.uid(), v_amount, p_plan::subscription_plan, 'subscription', 'wallet', 'confirmed', now(), auth.uid())
  returning * into v_payment;

  insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
  values (auth.uid(), 'purchase', 'out', v_amount, current_wallet_balance(auth.uid()) - v_amount, 'payment', v_payment.id,
    'Assinatura Brinde Mais (' || p_plan || ') - pagamento com saldo interno');

  v_interval := case p_plan when 'annual' then interval '365 days' else interval '30 days' end;

  select * into v_sub from subscriptions where subscriber_id = auth.uid() order by created_at desc limit 1;
  if v_sub.id is not null then
    update subscriptions set status = 'active', activated_at = now(), plan = p_plan::subscription_plan, amount = v_amount,
      expires_at = greatest(coalesce(expires_at, now()), now()) + v_interval, renewal_reminder_sent_at = null
    where id = v_sub.id
    returning * into v_sub;
  else
    insert into subscriptions (subscriber_id, status, plan, amount, activated_at, expires_at)
    values (auth.uid(), 'active', p_plan::subscription_plan, v_amount, now(), now() + v_interval)
    returning * into v_sub;
  end if;
  update payments set subscription_id = v_sub.id where id = v_payment.id;

  perform award_referral_bonuses(auth.uid(), v_amount, 'subscription', v_payment.id);

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'payment', 'Pagamento confirmado', 'Sua assinatura Brinde Mais está ativa! Pagamento feito com seu saldo interno.');

  return v_payment;
end;
$function$;

create or replace function public.award_referral_bonuses(p_source_subscriber_id uuid, p_base_amount numeric, p_type text, p_origin_payment_id uuid, p_origin_pickup_id uuid default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_current uuid;
  v_level int := 1;
  v_pct numeric;
  v_amount numeric;
  v_balance numeric;
  v_ref_type text;
  v_ref_id uuid;
  v_label text;
  v_source_name text;
  v_tx_type wallet_tx_type;
  v_origin_suffix text := '';
  v_payment_method text;
begin
  if p_base_amount <= 0 then
    return;
  end if;

  select referred_by into v_current from profiles where id = p_source_subscriber_id;
  select full_name into v_source_name from profiles where id = p_source_subscriber_id;

  if p_origin_payment_id is not null then
    select payment_method into v_payment_method from payments where id = p_origin_payment_id;
    v_origin_suffix := case v_payment_method
      when 'wallet' then ' (saldo interno)'
      when 'pix' then ' (Pix)'
      when 'credit_card' then ' (cartão)'
      when 'manual' then ' (ativação manual)'
      else ''
    end;
  end if;

  v_ref_type := case when p_origin_pickup_id is not null then 'pickup' else 'payment' end;
  v_ref_id := coalesce(p_origin_pickup_id, p_origin_payment_id);
  v_label := case p_type when 'subscription' then 'assinatura' when 'partner_fee' then 'indicação de parceiro' else 'consumo' end;
  v_tx_type := case p_type when 'subscription' then 'bonus_subscription'::wallet_tx_type when 'partner_fee' then 'bonus_partner_fee'::wallet_tx_type else 'bonus_consumption'::wallet_tx_type end;

  while v_current is not null and v_level <= 4 loop
    if p_type = 'subscription' then
      v_pct := case when v_level <= 2 then 19.0 else 1.0 end;
    elsif p_type = 'partner_fee' then
      v_pct := case when v_level <= 2 then 10.0 else 1.0 end;
    else
      v_pct := 1.0;
    end if;

    v_amount := round(p_base_amount * v_pct / 100.0, 2);

    if v_amount > 0 then
      insert into bonuses (beneficiary_id, source_subscriber_id, type, level, percent, amount, origin_payment_id, origin_pickup_id)
      values (v_current, p_source_subscriber_id, p_type, v_level, v_pct, v_amount, p_origin_payment_id, p_origin_pickup_id);

      select current_wallet_balance(v_current) + v_amount into v_balance;

      insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
      values (
        v_current, v_tx_type,
        'in', v_amount, v_balance, v_ref_type, v_ref_id,
        'Nível ' || v_level || ' (' || v_pct || '%) · ' || v_label || ' de ' || coalesce(v_source_name, 'alguém da sua rede') || v_origin_suffix
      );

      insert into notifications (user_id, type, title, message)
      values (v_current, 'bonus', 'Nova bonificação recebida', 'Você recebeu R$ ' || v_amount || ' de bonificação (nível ' || v_level || ').');
    end if;

    select referred_by into v_current from profiles where id = v_current;
    v_level := v_level + 1;
  end loop;
end;
$function$;
