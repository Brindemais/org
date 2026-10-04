-- Brinde do catálogo não tem mais "valor de referência" (decisão: é um
-- benefício sem custo pro assinante, sem valor nenhum atribuído pelo
-- parceiro) — então toda retirada de brinde passa a chamar
-- award_referral_bonuses com p_base_amount = 0. Sem essa guarda, o loop
-- calcularia v_amount = 0 e tentaria inserir em wallet_transactions, que
-- tem `check (amount > 0)` — a confirmação de retirada inteira quebraria
-- com violação de constraint pra qualquer parceiro sem valor configurado
-- (ou seja, todo mundo, no modelo novo).
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
  v_source_name text;
begin
  if p_base_amount <= 0 then
    return;
  end if;

  select referred_by into v_current from profiles where id = p_source_subscriber_id;
  select full_name into v_source_name from profiles where id = p_source_subscriber_id;

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

    if v_amount > 0 then
      insert into bonuses (beneficiary_id, source_subscriber_id, type, level, percent, amount, origin_payment_id, origin_pickup_id)
      values (v_current, p_source_subscriber_id, p_type, v_level, v_pct, v_amount, p_origin_payment_id, p_origin_pickup_id);

      select current_wallet_balance(v_current) + v_amount into v_balance;

      insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
      values (
        v_current,
        (case when p_type = 'subscription' then 'bonus_subscription' else 'bonus_consumption' end)::wallet_tx_type,
        'in', v_amount, v_balance, v_ref_type, v_ref_id,
        'Nível ' || v_level || ' (' || v_pct || '%) · ' || v_label || ' de ' || coalesce(v_source_name, 'alguém da sua rede')
      );

      insert into notifications (user_id, type, title, message)
      values (v_current, 'bonus', 'Nova bonificação recebida', 'Você recebeu R$ ' || v_amount || ' de bonificação (nível ' || v_level || ').');
    end if;

    select referred_by into v_current from profiles where id = v_current;
    v_level := v_level + 1;
  end loop;
end;
$$;
