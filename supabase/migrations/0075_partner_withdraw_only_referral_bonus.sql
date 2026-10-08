-- Decisão: a plataforma é só pra pagamento. Parceiro não saca mais pela
-- plataforma o líquido das próprias vendas — isso já cai direto na
-- conta Asaas dele via split (ou vai cair, quando ele tiver a subconta
-- aprovada, hoje obrigatória pra vender produto com preço); pra sacar
-- esse dinheiro ele usa a própria Asaas, não a Brinde Mais.
--
-- O que continua saindo pela plataforma (Pix via request_withdrawal) é
-- só o bônus de indicação do parceiro (bonus_subscription/
-- bonus_consumption/bonus_partner_fee) — isso nunca passou pela Asaas,
-- é crédito interno puro, sem outro jeito de sair.
--
-- available_bonus_balance é igual available_balance, mas conta só os 3
-- tipos de bônus como crédito ('purchase' = líquido de venda fica de
-- fora). request_withdrawal passa a usar essa função pra parceiro, e a
-- de sempre (available_balance) pra assinante — que não tem Asaas
-- própria, então o bônus dele continua saindo normalmente como hoje.
create or replace function available_bonus_balance(p_user_id uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case
    when direction = 'in' and type = 'bonus_subscription' then amount
    when direction = 'in' and type in ('bonus_consumption','bonus_partner_fee') and created_at <= now() - interval '30 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed';
$$;

revoke all on function available_bonus_balance(uuid) from public, anon;
grant execute on function available_bonus_balance(uuid) to authenticated;

create or replace function request_withdrawal(p_amount numeric, p_pix_key text) returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_avail numeric;
  v_recent_total numeric;
  v_w withdrawals;
  v_role user_role;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if p_amount < 50 then raise exception 'MINIMUM_WITHDRAWAL_50'; end if;

  select role into v_role from profiles where id = auth.uid();

  if v_role = 'partner' then
    select available_bonus_balance(auth.uid()) into v_avail;
  else
    select available_balance(auth.uid()) into v_avail;
  end if;
  if v_avail < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  select coalesce(sum(amount), 0) into v_recent_total
  from withdrawals
  where user_id = auth.uid() and status <> 'rejected' and requested_at >= now() - interval '30 days';
  if v_recent_total + p_amount > 1000 then raise exception 'MONTHLY_LIMIT_EXCEEDED'; end if;

  insert into withdrawals (user_id, amount, pix_key) values (auth.uid(), p_amount, p_pix_key)
  returning * into v_w;

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'withdrawal', 'Saque solicitado', 'Seu saque de R$ ' || p_amount || ' está em análise.');

  return v_w;
end;
$$;

revoke all on function request_withdrawal(numeric, text) from public, anon;
grant execute on function request_withdrawal(numeric, text) to authenticated;
