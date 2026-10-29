-- Pedido do dono, confirmado após relato real (print do app): bônus de
-- indicação de parceiro (quando alguém indica um comerciante e ele paga a
-- taxa de anunciante) também passa a ficar disponível na hora, igual
-- bônus de assinatura e de consumo — fica RETIDO só 'purchase' (renda de
-- venda do parceiro paga com saldo interno).
--
-- O repasse semanal automático toda segunda-feira (admin_list_partner_payouts
-- / admin_execute_partner_payout / admin-payout-partners) não precisa de
-- nenhuma mudança: ele já lê available_bonus_balance() na hora de montar a
-- lista, então só passa a enxergar esse saldo mais cedo. Continua existindo
-- como forma de repasse em lote; o parceiro também pode sacar na hora pelo
-- "Solicitar saque" normal agora, já que o saldo conta como disponível.
create or replace function public.available_balance(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(case
    when direction = 'in' and type in ('bonus_subscription', 'adjustment', 'bonus_consumption', 'bonus_partner_fee') then amount
    when direction = 'in' and type not in ('bonus_subscription', 'adjustment', 'bonus_consumption', 'bonus_partner_fee') and created_at <= now() - interval '7 days' then amount
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
    when direction = 'in' and type in ('bonus_subscription', 'bonus_consumption', 'bonus_partner_fee') then amount
    when direction = 'in' and type = 'purchase' and (
      created_at <= now() - interval '7 days'
      or exists (
        select 1 from product_orders po
        join payments pm on pm.id = po.payment_id
        where po.id = wallet_transactions.reference_id and pm.payment_method <> 'wallet'
      )
    ) then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$function$;
