-- Reverte as migrações 0099/0100: bonus_subscription e bonus_consumption
-- voltam a ficar disponíveis na hora SEMPRE, independente da forma de
-- pagamento que originou o bônus (Pix, cartão ou saldo interno). Pedido
-- explícito do dono após reclamação real de retenção indevida — bônus de
-- rede aparecendo como pendente quando deveriam estar no saldo
-- disponível. Volta exatamente ao comportamento da migração 0097.
--
-- bonus_partner_fee continua retido 7 dias sempre (sem mudança — nunca
-- dependeu de forma de pagamento). purchase (renda de venda do parceiro)
-- continua só retido quando pago com saldo interno (sem mudança, migração
-- 0098, regra diferente desta).
create or replace function public.available_balance(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(case
    when direction = 'in' and type in ('bonus_subscription', 'adjustment', 'bonus_consumption') then amount
    when direction = 'in' and type not in ('bonus_subscription', 'adjustment', 'bonus_consumption') and created_at <= now() - interval '7 days' then amount
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
    when direction = 'in' and type in ('bonus_subscription', 'bonus_consumption') then amount
    when direction = 'in' and type = 'bonus_partner_fee' and created_at <= now() - interval '7 days' then amount
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
