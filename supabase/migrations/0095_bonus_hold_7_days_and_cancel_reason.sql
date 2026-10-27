-- Reduz a espera de bônus/repasse pendente de 30 pra 7 dias (pedido
-- explícito do dono). Não mexe no limite mensal de saque (request_withdrawal),
-- que é um controle diferente (R$1000 a cada 30 dias).
create or replace function public.available_balance(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(case
    when direction = 'in' and type in ('bonus_subscription', 'adjustment') then amount
    when direction = 'in' and type not in ('bonus_subscription', 'adjustment') and created_at <= now() - interval '7 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$function$;

create or replace function public.available_bonus_balance(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(case
    when direction = 'in' and type = 'bonus_subscription' then amount
    when direction = 'in' and type in ('bonus_consumption','bonus_partner_fee','purchase') and created_at <= now() - interval '7 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$function$;

-- Guarda o motivo do estorno, pra aparecer pro usuário (não só em audit_logs).
alter table bonuses add column if not exists cancel_reason text;

drop function if exists admin_reverse_bonus(uuid);

create function admin_reverse_bonus(p_bonus_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $f$
declare
  v_bonus bonuses;
  v_balance numeric;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_bonus from bonuses where id = p_bonus_id for update;
  if v_bonus is null then raise exception 'BONUS_NOT_FOUND'; end if;
  if v_bonus.status = 'reversed' then raise exception 'ALREADY_REVERSED'; end if;

  v_balance := current_wallet_balance(v_bonus.beneficiary_id) - v_bonus.amount;

  insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
  values (v_bonus.beneficiary_id, 'reversal', 'out', v_bonus.amount, v_balance, 'bonus', v_bonus.id,
    'Bônus cancelado pelo administrador' || case when p_reason is not null and length(trim(p_reason)) > 0 then ' — motivo: ' || trim(p_reason) else '' end);

  update bonuses set status = 'reversed', cancel_reason = nullif(trim(p_reason), '') where id = p_bonus_id;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'admin_reverse_bonus', 'bonuses', p_bonus_id, jsonb_build_object('beneficiary_id', v_bonus.beneficiary_id, 'amount', v_bonus.amount, 'reason', p_reason));

  insert into notifications (user_id, type, title, message)
  values (v_bonus.beneficiary_id, 'bonus', 'Bônus cancelado',
    'Um bônus de R$ ' || v_bonus.amount || ' foi cancelado.' || case when p_reason is not null and length(trim(p_reason)) > 0 then ' Motivo: ' || trim(p_reason) else '' end);
end;
$f$;

revoke all on function admin_reverse_bonus(uuid, text) from public;
revoke all on function admin_reverse_bonus(uuid, text) from anon;
grant execute on function admin_reverse_bonus(uuid, text) to authenticated;
