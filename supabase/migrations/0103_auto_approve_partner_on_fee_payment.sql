-- Pedido do dono: quando o parceiro paga a taxa de anunciante, ele já sai
-- aprovado também — sem precisar que o admin aprove manualmente depois.
--
-- Hoje o cadastro público de parceiro (complete_partner_signup) nasce com
-- status = 'interested' (default da coluna), e list_public_partners() só
-- mostra quem está em status 'approved' ou 'active' — ou seja, mesmo
-- pagando e liberando o painel (is_advertiser = true), o parceiro não
-- aparecia pros assinantes até o admin mudar o status manualmente em
-- Parceiros (admin_set_partner_status).
--
-- confirm_payment() (cobre Pix via webhook e cartão, que chama essa mesma
-- função) e pay_partner_fee_wallet() (saldo interno) agora promovem o
-- status pra 'approved' automaticamente no momento da confirmação do
-- pagamento, mas só se ainda estiver numa etapa inicial do funil
-- (interested, pending_docs, analyzing) — nunca rebaixa 'active' pra
-- 'approved' nem mexe em 'suspended'/'rejected'/'closed', que são decisões
-- deliberadas do admin.
create or replace function public.confirm_payment(p_payment_id uuid, p_confirmed_by uuid default null, p_award_bonus boolean default true)
returns payments language plpgsql security definer set search_path = public as $function$
declare
  v_payment payments;
  v_sub subscriptions;
  v_interval interval;
begin
  if not (is_admin() or auth.role() = 'service_role') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update payments set status = 'confirmed', confirmed_at = now(), confirmed_by = coalesce(p_confirmed_by, auth.uid())
  where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    select * into v_payment from payments where id = p_payment_id;
    return v_payment;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'confirm_payment', 'payments', v_payment.id, jsonb_build_object('amount', v_payment.amount, 'type', v_payment.type, 'award_bonus', p_award_bonus));

  if v_payment.type = 'subscription' then
    v_interval := case coalesce(v_payment.plan, 'monthly') when 'annual' then interval '365 days' else interval '30 days' end;

    if v_payment.subscription_id is not null then
      update subscriptions set status = 'active', activated_at = now(),
        plan = coalesce(v_payment.plan, 'monthly'), amount = v_payment.amount,
        expires_at = greatest(coalesce(expires_at, now()), now()) + v_interval,
        renewal_reminder_sent_at = null
      where id = v_payment.subscription_id
      returning * into v_sub;
    else
      insert into subscriptions (subscriber_id, status, plan, amount, activated_at, expires_at)
      values (v_payment.subscriber_id, 'active', coalesce(v_payment.plan, 'monthly'), v_payment.amount, now(), now() + v_interval)
      returning * into v_sub;
      update payments set subscription_id = v_sub.id where id = v_payment.id;
    end if;

    if p_award_bonus then
      perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'subscription', v_payment.id);
    end if;

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Pagamento confirmado', 'Sua assinatura Brinde Mais está ativa! Escolha seu ponto de retirada.');

  elsif v_payment.type = 'store' then
    update store_orders set status = 'paid', payment_id = v_payment.id where id = v_payment.order_id;
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'order', 'Pedido confirmado', 'Seu pedido na loja Brinde Mais foi confirmado.');

  elsif v_payment.type = 'product_purchase' then
    update product_orders set status = 'ready' where payment_id = v_payment.id;
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'order', 'Compra confirmada', 'Seu pagamento foi confirmado. Apresente o(s) código(s) ao parceiro para retirar.');

  elsif v_payment.type = 'partner_fee' then
    update partners set is_advertiser = true,
      advertiser_expires_at = greatest(coalesce(advertiser_expires_at, now()), now()) + interval '30 days',
      status = case when status in ('interested', 'pending_docs', 'analyzing') then 'approved'::partner_status else status end,
      approved_at = case when status in ('interested', 'pending_docs', 'analyzing') then now() else approved_at end
    where id = v_payment.partner_id;

    if p_award_bonus then
      perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'partner_fee', v_payment.id);
    end if;

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Você é Anunciante Brinde Mais!', 'Sua taxa de anunciante foi confirmada. Acesse a área de anunciante no seu painel.');
  end if;

  return v_payment;
end;
$function$;

create or replace function public.pay_partner_fee_wallet()
 returns payments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_partner_id uuid;
  v_available numeric;
  v_payment payments;
  v_fee numeric := 149.90;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;

  select partner_id into v_partner_id from partner_staff where profile_id = auth.uid() limit 1;
  if v_partner_id is null then
    raise exception 'NOT_PARTNER_STAFF';
  end if;

  select available_balance(auth.uid()) into v_available;
  if coalesce(v_available, 0) < v_fee then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into payments (subscriber_id, partner_id, amount, type, payment_method, status, confirmed_at, confirmed_by)
  values (auth.uid(), v_partner_id, v_fee, 'partner_fee', 'wallet', 'confirmed', now(), auth.uid())
  returning * into v_payment;

  insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
  values (auth.uid(), 'purchase', 'out', v_fee, current_wallet_balance(auth.uid()) - v_fee, 'payment', v_payment.id,
    'Taxa de anunciante Brinde Mais - pagamento com saldo interno');

  update partners set is_advertiser = true,
    advertiser_expires_at = greatest(coalesce(advertiser_expires_at, now()), now()) + interval '30 days',
    status = case when status in ('interested', 'pending_docs', 'analyzing') then 'approved'::partner_status else status end,
    approved_at = case when status in ('interested', 'pending_docs', 'analyzing') then now() else approved_at end
  where id = v_partner_id;

  perform award_referral_bonuses(auth.uid(), v_fee, 'partner_fee', v_payment.id);

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'payment', 'Você é Anunciante Brinde Mais!', 'Sua taxa de anunciante foi paga com seu saldo interno. Acesse a área de anunciante no seu painel.');

  return v_payment;
end;
$function$;
