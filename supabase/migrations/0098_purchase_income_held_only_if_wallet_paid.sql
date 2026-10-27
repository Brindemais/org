-- Renda direta de venda do parceiro (tipo 'purchase') passa a seguir a
-- mesma lógica do Pix confirmado: só fica retida por 7 dias quando o
-- assinante pagou a compra com saldo interno (sem dinheiro de verdade
-- entrando ainda) — Pix, cartão (legado) e ativação manual já são
-- pagamento confirmado, então o crédito ao parceiro libera na hora.
-- bonus_partner_fee continua retido por 7 dias sempre (pagamento semanal
-- às segundas, já confirmado com o dono).
--
-- 'purchase' só vira wallet_transaction quando split_applied = false em
-- product_orders (confirm_product_order_delivery) — ou o parceiro não tem
-- conta Asaas pra split, ou o assinante pagou com saldo interno. O método
-- de pagamento original fica em payments.payment_method, encontrado via
-- product_orders.payment_id (reference_id da wallet_transaction aponta pro
-- product_order, não pro payment).
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
