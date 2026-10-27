-- Pedido do dono: em pagamentos via cartão (assinatura ou compra de
-- produto), os bônus/indicações gerados (bonus_subscription,
-- bonus_consumption) ficam retidos por 7 dias em vez de liberar na hora —
-- dá tempo da plataforma detectar estorno/chargeback (via webhook da
-- Asaas -> mark_payment_chargeback, que já reverte o bônus
-- automaticamente quando isso acontece) antes do dinheiro virar saldo
-- sacável. Pix e saldo interno continuam imediatos, porque já são
-- pagamento irreversível/confirmado de verdade. bonus_partner_fee
-- continua retido 7 dias sempre (sem condição de método de pagamento,
-- já era assim). purchase (venda do parceiro) não muda aqui — continua
-- só retido quando pago com saldo interno (migração 0098).
--
-- reference_id de bonus_subscription/bonus_consumption aponta direto pro
-- payments.id que originou o bônus (ver award_referral_bonuses:
-- v_ref_type sempre 'payment' pra esses dois tipos), então o join é
-- direto, sem precisar passar por product_orders como em 'purchase'.
create or replace function public.available_balance(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(case
    when direction = 'in' and type = 'adjustment' then amount
    when direction = 'in' and type in ('bonus_subscription', 'bonus_consumption') and (
      created_at <= now() - interval '7 days'
      or not exists (
        select 1 from payments pm where pm.id = wallet_transactions.reference_id and pm.payment_method = 'credit_card'
      )
    ) then amount
    when direction = 'in' and type not in ('adjustment', 'bonus_subscription', 'bonus_consumption') and created_at <= now() - interval '7 days' then amount
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
    when direction = 'in' and type in ('bonus_subscription', 'bonus_consumption') and (
      created_at <= now() - interval '7 days'
      or not exists (
        select 1 from payments pm where pm.id = wallet_transactions.reference_id and pm.payment_method = 'credit_card'
      )
    ) then amount
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
