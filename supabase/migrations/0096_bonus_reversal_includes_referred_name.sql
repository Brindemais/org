-- O estorno de bônus (admin_reverse_bonus) só dizia "cancelado pelo
-- administrador", sem citar de quem era a indicação — dificultava a
-- própria pessoa (ou o admin depois) rastrear qual indicação foi
-- cancelada só olhando o extrato. Agora inclui o nome de quem foi
-- indicado (source_subscriber_id) e o tipo/nível do bônus, tanto na
-- descrição do lançamento de estorno quanto na notificação.
create or replace function admin_reverse_bonus(p_bonus_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $f$
declare
  v_bonus bonuses;
  v_balance numeric;
  v_source_name text;
  v_label text;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_bonus from bonuses where id = p_bonus_id for update;
  if v_bonus is null then raise exception 'BONUS_NOT_FOUND'; end if;
  if v_bonus.status = 'reversed' then raise exception 'ALREADY_REVERSED'; end if;

  select full_name into v_source_name from profiles where id = v_bonus.source_subscriber_id;
  v_label := case v_bonus.type when 'subscription' then 'assinatura' when 'partner_fee' then 'indicação de parceiro' else 'consumo' end;

  v_balance := current_wallet_balance(v_bonus.beneficiary_id) - v_bonus.amount;

  insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
  values (v_bonus.beneficiary_id, 'reversal', 'out', v_bonus.amount, v_balance, 'bonus', v_bonus.id,
    'Cancelado: bônus de ' || v_label || ' de ' || coalesce(v_source_name, 'alguém da sua rede') || ' (nível ' || v_bonus.level || ')'
    || case when p_reason is not null and length(trim(p_reason)) > 0 then ' — motivo: ' || trim(p_reason) else '' end);

  update bonuses set status = 'reversed', cancel_reason = nullif(trim(p_reason), '') where id = p_bonus_id;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'admin_reverse_bonus', 'bonuses', p_bonus_id, jsonb_build_object('beneficiary_id', v_bonus.beneficiary_id, 'amount', v_bonus.amount, 'reason', p_reason));

  insert into notifications (user_id, type, title, message)
  values (v_bonus.beneficiary_id, 'bonus', 'Bônus cancelado',
    'Seu bônus de ' || v_label || ' de ' || coalesce(v_source_name, 'alguém da sua rede') || ' (R$ ' || v_bonus.amount || ') foi cancelado.'
    || case when p_reason is not null and length(trim(p_reason)) > 0 then ' Motivo: ' || trim(p_reason) else '' end);
end;
$f$;
