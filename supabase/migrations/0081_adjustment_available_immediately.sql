-- available_balance() segurava qualquer crédito que não fosse
-- bonus_subscription por 30 dias antes de liberar pro saque — correto
-- pra bônus de indicação (período de segurança contra fraude/estorno),
-- mas não faz sentido pra 'adjustment': é o admin decidindo e creditando
-- na hora, não tem período de risco a proteger. Sem isso, todo ajuste
-- manual de saldo aparecia como "saldo pendente" por 30 dias.
create or replace function available_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(case
    when direction = 'in' and type in ('bonus_subscription', 'adjustment') then amount
    when direction = 'in' and type not in ('bonus_subscription', 'adjustment') and created_at <= now() - interval '30 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed';
$$;
