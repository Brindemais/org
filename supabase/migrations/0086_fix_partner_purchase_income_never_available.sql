-- Bug confirmado com dados reais: request_withdrawal() usa
-- available_bonus_balance() pra decidir quanto um PARCEIRO pode sacar.
-- Mas available_bonus_balance() só reconhecia bonus_subscription,
-- bonus_consumption e bonus_partner_fee — o crédito de venda de produto
-- (type='purchase', entrada na carteira do parceiro depois de
-- confirm_product_order_delivery) caía no "else 0" e nunca contava como
-- disponível, nem depois de 30 dias. O parceiro vendia produto, o saldo
-- aparecia certinho no "Saldo total", mas "Disponível para saque" nunca
-- incluía esse valor — travado pra sempre, mesmo o dinheiro sendo real.
--
-- Inclui 'purchase' na mesma regra de 30 dias que já vale pra bônus de
-- consumo/indicação de parceiro (mesma janela de segurança contra
-- fraude/estorno, consistente com o resto do sistema).
create or replace function available_bonus_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(case
    when direction = 'in' and type = 'bonus_subscription' then amount
    when direction = 'in' and type in ('bonus_consumption','bonus_partner_fee','purchase') and created_at <= now() - interval '30 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin());
$$;
