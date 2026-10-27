-- Bônus de consumo (indicação de compra de produto na rede) passa a ficar
-- disponível na hora, igual bônus de assinatura — pedido do dono: esse
-- bônus nasce de um pagamento via Pix na Asaas (já confirmado antes do
-- bônus ser gerado), então não faz sentido segurar mais 7 dias. Só o
-- bônus de indicação de parceiro (bonus_partner_fee) e a renda direta de
-- venda do parceiro (purchase) continuam retidos por 7 dias.
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
    when direction = 'in' and type in ('bonus_partner_fee','purchase') and created_at <= now() - interval '7 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$function$;
