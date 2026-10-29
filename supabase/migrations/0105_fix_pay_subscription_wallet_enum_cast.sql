-- Segundo bug real achado testando o lado do assinante (depois de achar o
-- bug do pay_partner_fee_wallet): pay_subscription_wallet(p_plan text)
-- tentava gravar a variável texto p_plan direto nas colunas
-- payments.plan e subscriptions.plan, que são do tipo enum
-- subscription_plan — Postgres não faz esse cast automático pra uma
-- variável tipada (só funciona pra literal solto), então TODA chamada
-- real dessa função sempre falhava com "column is of type
-- subscription_plan but expression is of type text". Ou seja, pagar a
-- assinatura com saldo interno nunca funcionou em produção.
--
-- Corrige com cast explícito (p_plan::subscription_plan) nos três pontos
-- onde p_plan é gravado numa coluna tipada. Testado: assinatura mensal e
-- anual pagas com saldo interno, ambas gravando status/plan/amount
-- corretos em subscriptions e payments.
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

  v_amount := case p_plan when 'annual' then 1439.04 else 149.90 end;

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
