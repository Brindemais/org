-- Pedido do dono: no admin, poder trocar o patrocinador (quem indicou)
-- de um assinante ou parceiro já cadastrado — só enquanto esse cadastro
-- ainda estiver ativo (assinatura ativa e não vencida pro assinante,
-- anunciante ativo e não vencido pro parceiro). Depois de inativo, a
-- indicação já "fechou" e não dá mais pra corrigir por aqui.
--
-- Duas proteções a mais, além do is_admin():
--  1) não pode virar autoindicação (novo patrocinador = o próprio
--     usuário);
--  2) não pode criar ciclo na árvore (o novo patrocinador não pode ser
--     alguém que está, direta ou indiretamente, abaixo do usuário na
--     própria cadeia — senão profiles.referred_by forma um laço e
--     quebra toda função que percorre essa árvore recursivamente:
--     get_referral_tree, _subscriber_referral_active_counts).
create or replace function public.admin_change_referrer(p_user_id uuid, p_new_referrer_code text)
returns profiles
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_target profiles;
  v_new_referrer_id uuid;
  v_code_norm text;
  v_inactive boolean;
  v_walk uuid;
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_target from profiles where id = p_user_id;
  if v_target.id is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if v_target.role = 'subscriber' then
    v_inactive := not exists (
      select 1 from subscriptions
      where subscriber_id = v_target.id and status = 'active' and (expires_at is null or expires_at > now())
    );
  elsif v_target.role = 'partner' then
    v_inactive := not exists (
      select 1 from partners p
      join partner_staff ps on ps.partner_id = p.id
      where ps.profile_id = v_target.id and p.is_advertiser
        and (p.advertiser_expires_at is null or p.advertiser_expires_at > now())
    );
  else
    v_inactive := false;
  end if;

  if v_inactive then
    raise exception 'USER_INACTIVE';
  end if;

  v_code_norm := normalize_referral_code(p_new_referrer_code);
  if v_code_norm = '' then
    raise exception 'REFERRAL_REQUIRED';
  end if;
  select id into v_new_referrer_id from profiles where lower(referral_code) = v_code_norm;
  if v_new_referrer_id is null then
    raise exception 'REFERRER_NOT_FOUND';
  end if;

  if v_new_referrer_id = p_user_id then
    raise exception 'CANNOT_REFER_SELF';
  end if;

  v_walk := v_new_referrer_id;
  while v_walk is not null loop
    if v_walk = p_user_id then
      raise exception 'CIRCULAR_REFERRAL';
    end if;
    select referred_by into v_walk from profiles where id = v_walk;
  end loop;

  update profiles set referred_by = v_new_referrer_id where id = p_user_id returning * into v_target;

  update referrals set referrer_id = v_new_referrer_id where referred_id = p_user_id;
  if not found then
    insert into referrals (referrer_id, referred_id) values (v_new_referrer_id, p_user_id);
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'admin_change_referrer', 'profiles', p_user_id, jsonb_build_object('new_referrer_id', v_new_referrer_id, 'new_referrer_code', v_code_norm));

  return v_target;
end;
$f$;

revoke all on function public.admin_change_referrer(uuid, text) from public, anon;
grant execute on function public.admin_change_referrer(uuid, text) to authenticated;
