-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role in ('admin','operator'));
$$;

create or replace function is_partner_staff(p_partner_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from partner_staff where partner_id = p_partner_id and profile_id = auth.uid())
      or is_admin();
$$;

create or replace function current_wallet_balance(p_user_id uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when direction = 'in' then amount else -amount end), 0)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed';
$$;

create or replace function pending_withdrawals_total(p_user_id uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount),0) from withdrawals
  where user_id = p_user_id and status in ('requested','analyzing','approved');
$$;

create or replace function available_balance(p_user_id uuid) returns numeric language sql stable security definer set search_path = public as $$
  select current_wallet_balance(p_user_id) - pending_withdrawals_total(p_user_id);
$$;

create or replace function generate_referral_code() returns text language plpgsql set search_path = public, extensions as $$
declare
  code text;
  exists_code boolean;
begin
  loop
    code := upper(substr(encode(gen_random_bytes(6),'base64'),1,7));
    code := regexp_replace(code, '[^A-Za-z0-9]', '', 'g');
    exit when length(code) >= 6;
  end loop;
  code := 'BM' || upper(substr(code,1,6));
  select exists(select 1 from profiles where referral_code = code) into exists_code;
  if exists_code then
    return generate_referral_code();
  end if;
  return code;
end;
$$;

create or replace function generate_pickup_code() returns text language plpgsql set search_path = public as $$
declare
  v_code text;
  exists_code boolean;
begin
  v_code := 'BM' || to_char(floor(random()*90000+10000), 'FM00000');
  select exists(select 1 from pickups where pickups.code = v_code) into exists_code;
  if exists_code then
    return generate_pickup_code();
  end if;
  return v_code;
end;
$$;

-- ============================================================
-- SIGNUP: complete profile after auth.signUp
-- ============================================================
create or replace function complete_signup(
  p_full_name text, p_cpf text, p_birth_date date, p_phone text, p_email text, p_referral_code text default null
) returns profiles language plpgsql security definer set search_path = public as $$
declare
  v_referrer_id uuid;
  v_profile profiles;
begin
  if exists (select 1 from profiles where cpf = p_cpf) then
    raise exception 'CPF_ALREADY_REGISTERED';
  end if;

  if p_referral_code is not null and length(trim(p_referral_code)) > 0 then
    select id into v_referrer_id from profiles where referral_code = upper(trim(p_referral_code));
    if v_referrer_id = auth.uid() then
      v_referrer_id := null;
    end if;
  end if;

  insert into profiles (id, full_name, cpf, birth_date, phone, email, referral_code, referred_by)
  values (auth.uid(), p_full_name, p_cpf, p_birth_date, p_phone, p_email, generate_referral_code(), v_referrer_id)
  returning * into v_profile;

  if v_referrer_id is not null then
    insert into referrals (referrer_id, referred_id) values (v_referrer_id, auth.uid());
  end if;

  return v_profile;
end;
$$;

-- ============================================================
-- AWARD REFERRAL BONUSES (walks up to 7 levels)
-- ============================================================
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
      v_pct := case when v_level = 1 then 10.0 else 1.0 end;
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

-- ============================================================
-- CONFIRM PAYMENT (idempotent, admin-only) -> activates subscription / order + awards bonuses
-- ============================================================
create or replace function confirm_payment(p_payment_id uuid, p_confirmed_by uuid default null) returns payments language plpgsql security definer set search_path = public as $$
declare
  v_payment payments;
  v_sub subscriptions;
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

  if v_payment.type = 'subscription' then
    if v_payment.subscription_id is not null then
      update subscriptions set status = 'active', activated_at = now(),
        expires_at = greatest(coalesce(expires_at, now()), now()) + interval '30 days'
      where id = v_payment.subscription_id
      returning * into v_sub;
    else
      insert into subscriptions (subscriber_id, status, amount, activated_at, expires_at)
      values (v_payment.subscriber_id, 'active', v_payment.amount, now(), now() + interval '30 days')
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
  end if;

  return v_payment;
end;
$$;

-- ============================================================
-- CHOOSE PICKUP PARTNER (reserve monthly gift)
-- ============================================================
create or replace function choose_pickup_partner(p_subscription_id uuid, p_partner_id uuid) returns pickups language plpgsql security definer set search_path = public as $$
declare
  v_sub subscriptions;
  v_total_stock int;
  v_pickup pickups;
  v_month int; v_year int;
begin
  select * into v_sub from subscriptions where id = p_subscription_id and subscriber_id = auth.uid();
  if v_sub.id is null or v_sub.status <> 'active' then
    raise exception 'SUBSCRIPTION_NOT_ACTIVE';
  end if;

  v_month := extract(month from now())::int;
  v_year := extract(year from now())::int;

  if exists (
    select 1 from pickups where subscriber_id = auth.uid() and cycle_month = v_month and cycle_year = v_year
      and status in ('reserved','ready')
  ) then
    raise exception 'PICKUP_ALREADY_CHOSEN';
  end if;

  select coalesce(sum(quantity),0) into v_total_stock from stock_partner where partner_id = p_partner_id;
  if v_total_stock <= 0 then
    raise exception 'PARTNER_OUT_OF_STOCK';
  end if;

  insert into pickups (subscriber_id, subscription_id, partner_id, status, code, cycle_month, cycle_year, deadline)
  values (auth.uid(), p_subscription_id, p_partner_id, 'ready', generate_pickup_code(), v_month, v_year, now() + interval '30 days')
  returning * into v_pickup;

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'pickup', 'Ponto de retirada escolhido', 'Retire seu brinde em até 30 dias.');

  return v_pickup;
end;
$$;

-- ============================================================
-- PARTNER CONFIRMS DELIVERY (baixa de estoque)
-- ============================================================
create or replace function confirm_pickup_delivery(p_pickup_id uuid, p_product_id uuid, p_withdrawn_by text default null) returns pickups language plpgsql security definer set search_path = public as $$
declare
  v_pickup pickups;
  v_qty int;
begin
  select * into v_pickup from pickups where id = p_pickup_id;
  if v_pickup.id is null then raise exception 'PICKUP_NOT_FOUND'; end if;
  if not is_partner_staff(v_pickup.partner_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if v_pickup.status <> 'ready' then raise exception 'PICKUP_NOT_READY'; end if;

  select quantity into v_qty from stock_partner where partner_id = v_pickup.partner_id and product_id = p_product_id for update;
  if v_qty is null or v_qty <= 0 then raise exception 'NO_STOCK'; end if;

  update stock_partner set quantity = quantity - 1 where partner_id = v_pickup.partner_id and product_id = p_product_id;

  insert into stock_movements (product_id, partner_id, type, quantity, prior_balance, new_balance, reason, responsible_id, reference_id)
  values (p_product_id, v_pickup.partner_id, 'delivery', -1, v_qty, v_qty - 1, 'Retirada confirmada', auth.uid(), p_pickup_id);

  update pickups set status = 'withdrawn', product_id = p_product_id, confirmed_by = auth.uid(),
    confirmed_at = now(), actually_withdrawn_by = coalesce(p_withdrawn_by, 'Assinante')
  where id = p_pickup_id
  returning * into v_pickup;

  insert into notifications (user_id, type, title, message)
  values (v_pickup.subscriber_id, 'pickup', 'Retirada confirmada', 'Seu brinde foi entregue com sucesso. Aproveite!');

  return v_pickup;
end;
$$;

-- ============================================================
-- PARTNER CANCELS PICKUP
-- ============================================================
create or replace function cancel_pickup_by_partner(p_pickup_id uuid, p_reason text) returns pickups language plpgsql security definer set search_path = public as $$
declare
  v_pickup pickups;
begin
  select * into v_pickup from pickups where id = p_pickup_id;
  if v_pickup.id is null then raise exception 'PICKUP_NOT_FOUND'; end if;
  if not is_partner_staff(v_pickup.partner_id) then raise exception 'NOT_AUTHORIZED'; end if;

  update pickups set status = 'cancelled', cancelled_reason = p_reason where id = p_pickup_id returning * into v_pickup;

  insert into notifications (user_id, type, title, message)
  values (v_pickup.subscriber_id, 'pickup_cancelled', 'Retirada cancelada pelo parceiro',
    'O parceiro cancelou sua retirada (' || p_reason || '). Escolha outro ponto de retirada disponível.');

  return v_pickup;
end;
$$;

-- ============================================================
-- STOCK MOVEMENTS - admin/partner
-- ============================================================
create or replace function matrix_stock_entry(p_product_id uuid, p_quantity int, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare v_prior int;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  insert into stock_matrix (product_id, quantity) values (p_product_id, 0)
    on conflict (product_id) do nothing;
  select quantity into v_prior from stock_matrix where product_id = p_product_id for update;
  update stock_matrix set quantity = quantity + p_quantity where product_id = p_product_id;
  insert into stock_movements (product_id, type, quantity, prior_balance, new_balance, reason, responsible_id)
  values (p_product_id, 'entry', p_quantity, v_prior, v_prior + p_quantity, p_reason, auth.uid());
end;
$$;

create or replace function transfer_stock_to_partner(p_product_id uuid, p_partner_id uuid, p_quantity int, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare v_matrix_qty int; v_partner_qty int;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select quantity into v_matrix_qty from stock_matrix where product_id = p_product_id for update;
  if v_matrix_qty is null or v_matrix_qty < p_quantity then raise exception 'INSUFFICIENT_MATRIX_STOCK'; end if;

  update stock_matrix set quantity = quantity - p_quantity where product_id = p_product_id;
  insert into stock_movements (product_id, partner_id, type, quantity, prior_balance, new_balance, reason, responsible_id)
  values (p_product_id, p_partner_id, 'transfer_out', -p_quantity, v_matrix_qty, v_matrix_qty - p_quantity, p_reason, auth.uid());

  insert into stock_partner (partner_id, product_id, quantity) values (p_partner_id, p_product_id, p_quantity)
    on conflict (partner_id, product_id) do update set quantity = stock_partner.quantity + p_quantity;

  select quantity into v_partner_qty from stock_partner where partner_id = p_partner_id and product_id = p_product_id;
  insert into stock_movements (product_id, partner_id, type, quantity, prior_balance, new_balance, reason, responsible_id)
  values (p_product_id, p_partner_id, 'transfer_in', p_quantity, v_partner_qty - p_quantity, v_partner_qty, p_reason, auth.uid());
end;
$$;

create or replace function partner_adjust_stock(p_product_id uuid, p_partner_id uuid, p_quantity int, p_type stock_movement_type, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare v_prior int;
begin
  if not is_partner_staff(p_partner_id) then raise exception 'NOT_AUTHORIZED'; end if;
  select quantity into v_prior from stock_partner where partner_id = p_partner_id and product_id = p_product_id for update;
  if v_prior is null then
    v_prior := 0;
    insert into stock_partner (partner_id, product_id, quantity) values (p_partner_id, p_product_id, 0);
  end if;
  if v_prior + p_quantity < 0 then raise exception 'STOCK_CANNOT_BE_NEGATIVE'; end if;
  update stock_partner set quantity = quantity + p_quantity where partner_id = p_partner_id and product_id = p_product_id;
  insert into stock_movements (product_id, partner_id, type, quantity, prior_balance, new_balance, reason, responsible_id)
  values (p_product_id, p_partner_id, p_type, p_quantity, v_prior, v_prior + p_quantity, p_reason, auth.uid());
end;
$$;

-- ============================================================
-- WITHDRAWALS
-- ============================================================
create or replace function request_withdrawal(p_amount numeric, p_pix_key text) returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_avail numeric;
  v_w withdrawals;
begin
  if p_amount < 100 then raise exception 'MINIMUM_WITHDRAWAL_100'; end if;
  select available_balance(auth.uid()) into v_avail;
  if v_avail < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into withdrawals (user_id, amount, pix_key) values (auth.uid(), p_amount, p_pix_key)
  returning * into v_w;

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'withdrawal', 'Saque solicitado', 'Seu saque de R$ ' || p_amount || ' está em análise.');

  return v_w;
end;
$$;

create or replace function process_withdrawal(p_withdrawal_id uuid, p_new_status withdrawal_status, p_notes text default null) returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_w withdrawals;
  v_balance numeric;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_w from withdrawals where id = p_withdrawal_id;
  if v_w.id is null then raise exception 'NOT_FOUND'; end if;

  update withdrawals set status = p_new_status, processed_by = auth.uid(), processed_at = now(),
    notes = coalesce(p_notes, notes)
  where id = p_withdrawal_id returning * into v_w;

  if p_new_status = 'paid' then
    select current_wallet_balance(v_w.user_id) - v_w.amount into v_balance;
    insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
    values (v_w.user_id, 'withdrawal', 'out', v_w.amount, v_balance, 'withdrawal', v_w.id, 'Saque via Pix');
  end if;

  insert into notifications (user_id, type, title, message)
  values (v_w.user_id, 'withdrawal',
    case p_new_status when 'approved' then 'Saque aprovado' when 'paid' then 'Saque pago' when 'rejected' then 'Saque recusado' else 'Saque atualizado' end,
    'Seu saque de R$ ' || v_w.amount || ' foi ' ||
    case p_new_status when 'approved' then 'aprovado.' when 'paid' then 'pago com sucesso.' when 'rejected' then ('recusado. ' || coalesce(p_notes,'')) else 'atualizado.' end
  );

  return v_w;
end;
$$;

-- ============================================================
-- ADMIN: approve partner / promotion
-- ============================================================
create or replace function admin_set_partner_status(p_partner_id uuid, p_status partner_status) returns partners language plpgsql security definer set search_path = public as $$
declare v_p partners;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update partners set status = p_status, approved_at = case when p_status in ('approved','active') then now() else approved_at end
  where id = p_partner_id returning * into v_p;
  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'set_partner_status', 'partners', p_partner_id, jsonb_build_object('status', p_status));
  return v_p;
end;
$$;

create or replace function admin_set_promotion_status(p_promotion_id uuid, p_status promotion_status) returns promotions language plpgsql security definer set search_path = public as $$
declare v_pr promotions;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update promotions set status = p_status where id = p_promotion_id returning * into v_pr;
  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'set_promotion_status', 'promotions', p_promotion_id, jsonb_build_object('status', p_status));
  return v_pr;
end;
$$;
