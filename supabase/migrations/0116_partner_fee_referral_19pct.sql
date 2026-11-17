-- Pedido do dono: a comissão de indicação de parceiro (taxa de adesão)
-- também sobe de 10% para 19% nos níveis 1 e 2 — igual já é a
-- comissão de indicação de assinatura desde a migração 0106. Níveis 3
-- e 4 permanecem em 1%, sem mudança.
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
      v_pct := case when v_level <= 2 then 19.0 else 1.0 end;
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
