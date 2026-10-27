-- Pedido do dono: assinatura/compra de produto paga com SALDO INTERNO
-- também passa a reter o bônus de indicação gerado (bonus_subscription,
-- bonus_consumption) por 7 dias, igual já acontecia pra pagamento no
-- cartão (migração 0099). Agora só Pix (e ativação manual do admin)
-- liberam o bônus na hora — cartão e saldo interno ficam retidos 7 dias.
--
-- Não muda bonus_partner_fee (já retido 7 dias sempre) nem purchase
-- (continua só retido quando pago com saldo interno, migração 0098 —
-- regra diferente, sobre a renda do PARCEIRO, não sobre o bônus de quem
-- indicou).
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
        select 1 from payments pm where pm.id = wallet_transactions.reference_id and pm.payment_method in ('credit_card', 'wallet')
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
        select 1 from payments pm where pm.id = wallet_transactions.reference_id and pm.payment_method in ('credit_card', 'wallet')
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
