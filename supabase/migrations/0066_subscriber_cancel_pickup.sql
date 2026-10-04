-- Assinante pode cancelar a própria retirada (pra escolher outro parceiro),
-- desde que ainda não tenha retirado o brinde e ainda esteja dentro do
-- prazo de 30 dias (deadline). Continua valendo só 1 brinde por mês: ao
-- cancelar, a reserva fica com status 'cancelled' e libera o ciclo pra uma
-- nova escolha (mesma regra de PICKUP_ALREADY_CHOSEN em choose_pickup_partner).
--
-- A constraint antiga (subscriber_id, cycle_month, cycle_year, status) era
-- unique pra qualquer status — travaria um segundo cancelamento no mesmo
-- ciclo (ex: escolhe parceiro A, cancela, escolhe parceiro B, cancela de
-- novo). Troca por um índice parcial que só proíbe duas reservas *ativas*
-- (reserved/ready) no mesmo ciclo — histórico de cancelamentos/retiradas
-- pode repetir livremente.
alter table pickups drop constraint if exists pickups_subscriber_id_cycle_month_cycle_year_status_key;
create unique index if not exists pickups_one_active_per_cycle
  on pickups(subscriber_id, cycle_month, cycle_year)
  where status in ('reserved','ready');

create or replace function cancel_pickup_by_subscriber(p_pickup_id uuid)
returns pickups
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pickup pickups;
begin
  select * into v_pickup from pickups where id = p_pickup_id and subscriber_id = auth.uid();
  if v_pickup.id is null then raise exception 'PICKUP_NOT_FOUND'; end if;
  if v_pickup.status not in ('reserved','ready') then raise exception 'PICKUP_NOT_CANCELLABLE'; end if;
  if v_pickup.deadline < now() then raise exception 'PICKUP_DEADLINE_PASSED'; end if;

  update pickups set status = 'cancelled', cancelled_reason = 'subscriber_cancelled'
  where id = p_pickup_id
  returning * into v_pickup;

  return v_pickup;
end;
$$;

revoke all on function cancel_pickup_by_subscriber(uuid) from public;
revoke all on function cancel_pickup_by_subscriber(uuid) from anon;
grant execute on function cancel_pickup_by_subscriber(uuid) to authenticated;
