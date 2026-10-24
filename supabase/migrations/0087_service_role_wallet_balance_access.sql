-- Permite que chamadas feitas com a service_role key (edge functions
-- internas, como o repasse semanal de parceiros) leiam saldo de qualquer
-- usuário, além do próprio dono e do admin. Sem isso, a trava de segurança
-- adicionada na 0084 (p_user_id = auth.uid() or is_admin()) bloqueava
-- também o uso legítimo por edge functions, que não carregam JWT de usuário.

create or replace function current_wallet_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(case when direction = 'in' then amount else -amount end), 0)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$$;

create or replace function public.available_balance(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(case
    when direction = 'in' and type in ('bonus_subscription', 'adjustment') then amount
    when direction = 'in' and type not in ('bonus_subscription', 'adjustment') and created_at <= now() - interval '30 days' then amount
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
    when direction = 'in' and type in ('bonus_consumption','bonus_partner_fee','purchase') and created_at <= now() - interval '30 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$function$;

create or replace function public.pending_withdrawals_total(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(amount),0) from withdrawals
  where user_id = p_user_id and status in ('requested','analyzing','approved')
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$function$;
