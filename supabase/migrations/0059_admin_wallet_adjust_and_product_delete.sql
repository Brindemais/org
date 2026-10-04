-- Financeiro: admin ganha ajuste manual de saldo (positivo ou negativo) e
-- estorno de um bônus específico — pedido explícito do dono da plataforma.
-- Reaproveita o padrão de estorno já usado manualmente via SQL nesta sessão
-- pro caso do bônus duplicado (wallet_transactions type='reversal' +
-- bonuses.status='reversed'), agora como RPC reutilizável pelo admin.
create or replace function admin_adjust_wallet(p_user_id uuid, p_amount numeric, p_reason text default null)
returns wallet_transactions language plpgsql security definer set search_path = public as $$
declare
  v_tx wallet_transactions;
  v_balance numeric;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_amount = 0 then raise exception 'AMOUNT_CANNOT_BE_ZERO'; end if;

  v_balance := current_wallet_balance(p_user_id) + p_amount;

  insert into wallet_transactions (user_id, type, direction, amount, balance_after, description)
  values (
    p_user_id, 'adjustment', case when p_amount > 0 then 'in' else 'out' end, abs(p_amount), v_balance,
    coalesce(p_reason, 'Ajuste manual pelo administrador')
  )
  returning * into v_tx;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'admin_adjust_wallet', 'wallet_transactions', v_tx.id, jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'reason', p_reason));

  return v_tx;
end;
$$;
revoke all on function admin_adjust_wallet(uuid, numeric, text) from public, anon;
grant execute on function admin_adjust_wallet(uuid, numeric, text) to authenticated;

create or replace function admin_reverse_bonus(p_bonus_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_bonus bonuses;
  v_balance numeric;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_bonus from bonuses where id = p_bonus_id for update;
  if v_bonus is null then raise exception 'BONUS_NOT_FOUND'; end if;
  if v_bonus.status = 'reversed' then raise exception 'ALREADY_REVERSED'; end if;

  v_balance := current_wallet_balance(v_bonus.beneficiary_id) - v_bonus.amount;

  insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
  values (v_bonus.beneficiary_id, 'reversal', 'out', v_bonus.amount, v_balance, 'bonus', v_bonus.id, 'Estorno de bônus pelo administrador');

  update bonuses set status = 'reversed' where id = p_bonus_id;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'admin_reverse_bonus', 'bonuses', p_bonus_id, jsonb_build_object('beneficiary_id', v_bonus.beneficiary_id, 'amount', v_bonus.amount));
end;
$$;
revoke all on function admin_reverse_bonus(uuid) from public, anon;
grant execute on function admin_reverse_bonus(uuid) to authenticated;

-- Excluir produto: não existia nenhuma policy de delete em `products` (RLS
-- nega por padrão sem policy — era literalmente impossível excluir, só
-- pausar). FKs sem cascade em stock_movements/pickups/store_order_items já
-- protegem histórico — a exclusão falha sozinha com violação de FK se o
-- produto já tiver movimentação, e a UI trata isso com uma mensagem amigável
-- sugerindo pausar em vez de excluir.
create policy products_delete on products for delete using (is_admin() or (partner_id is not null and is_partner_staff(partner_id)));
