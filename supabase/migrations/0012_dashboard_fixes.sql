-- 1) subscriptions has no UPDATE policy at all — the subscriber's own
-- "Cancelar assinatura" button in Profile.tsx does a raw client update that
-- silently affects 0 rows (RLS blocks it, and the client never checks the
-- error), so the person believes they cancelled while still being billed.
-- Route cancellation through an RPC instead of opening a broad UPDATE
-- policy — subscribers should never be able to touch amount/expires_at.
create or replace function cancel_subscription(p_subscription_id uuid) returns subscriptions language plpgsql security definer set search_path = public as $$
declare v_sub subscriptions;
begin
  select * into v_sub from subscriptions where id = p_subscription_id;
  if v_sub.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if v_sub.subscriber_id <> auth.uid() and not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if v_sub.status not in ('active','overdue') then raise exception 'SUBSCRIPTION_NOT_CANCELLABLE'; end if;

  update subscriptions set status = 'cancelled', cancelled_at = now() where id = p_subscription_id returning * into v_sub;

  insert into notifications (user_id, type, title, message)
  values (v_sub.subscriber_id, 'subscription', 'Assinatura cancelada', 'Sua assinatura Brinde Mais foi cancelada.');

  return v_sub;
end;
$$;
