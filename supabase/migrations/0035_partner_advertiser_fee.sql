-- ============================================================
-- Taxa obrigatória de anunciante para parceiro (R$149,90, mesmo valor
-- e cadência da assinatura do consumidor — mensal).
--
-- Só vale para quem se cadastra como parceiro DAQUI PRA FRENTE
-- (requires_fee). Parceiros já aprovados hoje ficam como estão, sem
-- precisar pagar nada — partners.requires_fee nasce false por
-- default, então toda linha existente já fica de fora automaticamente;
-- só o insert de PartnerSignup.tsx passa a mandar true explicitamente.
--
-- "Só pode ser parceiro se for assinante": a policy payments_insert já
-- exige is_active_subscriber() pra qualquer pessoa (fora admin) inserir
-- uma linha em payments — então a própria pessoa responsável pelo
-- parceiro só consegue pagar essa taxa (e com isso liberar o acesso de
-- anunciante) se já for assinante ativa da Brinde Mais. Não precisa de
-- nenhuma trava nova pra isso, a regra que já existe cobre.
-- ============================================================

alter table partners
  add column requires_fee boolean not null default false,
  add column is_advertiser boolean not null default false,
  add column advertiser_expires_at timestamptz;

alter table payments add column partner_id uuid references partners(id);

create or replace function confirm_payment(p_payment_id uuid, p_confirmed_by uuid default null) returns payments language plpgsql security definer set search_path = public as $$
declare
  v_payment payments;
  v_sub subscriptions;
  v_interval interval;
begin
  if not is_admin() then
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
  values (auth.uid(), 'confirm_payment', 'payments', v_payment.id, jsonb_build_object('amount', v_payment.amount, 'type', v_payment.type));

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

    perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'subscription', v_payment.id);

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Pagamento confirmado', 'Sua assinatura Brinde Mais está ativa! Escolha seu ponto de retirada.');

  elsif v_payment.type = 'store' then
    update store_orders set status = 'paid', payment_id = v_payment.id where id = v_payment.order_id;
    perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'consumption', v_payment.id);
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'order', 'Pedido confirmado', 'Seu pedido na loja Brinde Mais foi confirmado.');

  elsif v_payment.type = 'partner_fee' then
    update partners set is_advertiser = true,
      advertiser_expires_at = greatest(coalesce(advertiser_expires_at, now()), now()) + interval '30 days'
    where id = v_payment.partner_id;

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Você é Anunciante Brinde Mais!', 'Sua taxa de anunciante foi confirmada. Acesse a área de anunciante no seu painel.');
  end if;

  return v_payment;
end;
$$;
