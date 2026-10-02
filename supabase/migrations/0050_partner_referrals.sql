-- ============================================================
-- Indicação de parceiro: quem indica (assinante ou parceiro, qualquer
-- profile com código) ganha bonificação de 1% por nível (4 níveis) sobre
-- a taxa de anunciante paga pelo parceiro indicado — mesma regra já usada
-- pra bonificação de consumo.
-- ============================================================

-- complete_partner_signup ganha p_referral_code — assinatura nova (12
-- args). A antiga de 11 args fica como overload morto se não tratada:
-- mesma classe de bug já corrigida nesta sessão pro award_referral_bonuses
-- e pro confirm_pickup_delivery.
--
-- NOTA: "drop function" nesta instância do projeto ficou travando
-- indefinidamente (sem lock nem query ativa visível em pg_stat_activity —
-- aparenta ser algo na infraestrutura/MCP, não um lock real). Workaround:
-- renomear o overload antigo em vez de derrubar, e revogar toda
-- permissão dele, deixando-o órfão e inacessível.
alter function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text)
  rename to complete_partner_signup_stale_v1;
revoke all on function complete_partner_signup_stale_v1(text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function complete_partner_signup(
  p_company_name text, p_trade_name text, p_cnpj_cpf text, p_responsible_name text,
  p_phone text, p_whatsapp text, p_email text, p_category text,
  p_city text, p_neighborhood text, p_address text, p_referral_code text default null
) returns partners language plpgsql security definer set search_path = public as $$
declare
  v_partner partners;
  v_referrer_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'PROFILE_ALREADY_EXISTS';
  end if;

  if p_referral_code is not null and length(trim(p_referral_code)) > 0 then
    select id into v_referrer_id from profiles where referral_code = upper(trim(p_referral_code));
    if v_referrer_id = auth.uid() then
      v_referrer_id := null;
    end if;
  end if;

  insert into profiles (id, role, full_name, email, phone, referral_code, referred_by)
  values (auth.uid(), 'partner', p_responsible_name, p_email, p_phone, generate_referral_code(), v_referrer_id);

  insert into partners (company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, category, city, neighborhood, address, requires_fee)
  values (p_company_name, p_trade_name, p_cnpj_cpf, p_responsible_name, p_phone, coalesce(nullif(p_whatsapp, ''), p_phone), p_email, p_category, p_city, p_neighborhood, p_address, true)
  returning * into v_partner;

  insert into partner_staff (partner_id, profile_id) values (v_partner.id, auth.uid());

  if v_referrer_id is not null then
    insert into referrals (referrer_id, referred_id) values (v_referrer_id, auth.uid());
  end if;

  return v_partner;
end;
$$;

revoke all on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

-- award_referral_bonuses: mesma assinatura (5 args), só ganha um rótulo
-- de descrição próprio pro tipo 'partner_fee' — o percentual já cai no
-- ramo "else" (1% por nível) igual consumo, sem precisar mudar a lógica.
create or replace function award_referral_bonuses(
  p_source_subscriber_id uuid, p_base_amount numeric, p_type text, p_origin_payment_id uuid,
  p_origin_pickup_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_current uuid;
  v_level int := 1;
  v_pct numeric;
  v_amount numeric;
  v_balance numeric;
  v_ref_type text;
  v_ref_id uuid;
  v_label text;
begin
  select referred_by into v_current from profiles where id = p_source_subscriber_id;

  v_ref_type := case when p_origin_pickup_id is not null then 'pickup' else 'payment' end;
  v_ref_id := coalesce(p_origin_pickup_id, p_origin_payment_id);
  v_label := case p_type when 'subscription' then 'assinatura' when 'partner_fee' then 'indicação de parceiro' else 'consumo' end;

  while v_current is not null and v_level <= 4 loop
    if p_type = 'subscription' then
      v_pct := case when v_level <= 2 then 10.0 else 1.0 end;
    else
      v_pct := 1.0;
    end if;

    v_amount := round(p_base_amount * v_pct / 100.0, 2);

    insert into bonuses (beneficiary_id, source_subscriber_id, type, level, percent, amount, origin_payment_id, origin_pickup_id)
    values (v_current, p_source_subscriber_id, p_type, v_level, v_pct, v_amount, p_origin_payment_id, p_origin_pickup_id);

    select current_wallet_balance(v_current) + v_amount into v_balance;

    insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
    values (
      v_current,
      (case when p_type = 'subscription' then 'bonus_subscription' else 'bonus_consumption' end)::wallet_tx_type,
      'in', v_amount, v_balance, v_ref_type, v_ref_id,
      'Bonificação nível ' || v_level || ' (' || v_pct || '%) - ' || v_label
    );

    insert into notifications (user_id, type, title, message)
    values (v_current, 'bonus', 'Nova bonificação recebida', 'Você recebeu R$ ' || v_amount || ' de bonificação (nível ' || v_level || ').');

    select referred_by into v_current from profiles where id = v_current;
    v_level := v_level + 1;
  end loop;
end;
$$;

-- confirm_payment: mesma assinatura (2 args) — ramo partner_fee ganha a
-- chamada de bonificação, igual os outros dois ramos já tinham.
create or replace function confirm_payment(p_payment_id uuid, p_confirmed_by uuid default null) returns payments language plpgsql security definer set search_path = public as $$
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

    perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'partner_fee', v_payment.id);

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Você é Anunciante Brinde Mais!', 'Sua taxa de anunciante foi confirmada. Acesse a área de anunciante no seu painel.');
  end if;

  return v_payment;
end;
$$;
