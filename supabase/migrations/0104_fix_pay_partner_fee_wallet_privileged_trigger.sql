-- Achado ao testar a migração 0103 (aprovação automática do parceiro):
-- pay_partner_fee_wallet() é chamada diretamente pelo próprio parceiro
-- autenticado (não admin, não service_role) — e o trigger
-- protect_partners_privileged_columns() bloqueia QUALQUER UPDATE em
-- is_advertiser/advertiser_expires_at/status/approved_at/etc vindo de
-- quem não é admin/service_role. Isso significa que o pagamento da taxa
-- de anunciante com SALDO INTERNO já estava quebrado em produção antes
-- mesmo da 0103 (a função já atualizava is_advertiser direto desde a
-- migração 0090) — ninguém deve ter testado esse caminho específico
-- ainda, porque a função simplesmente lançava CANNOT_CHANGE_PRIVILEGED_FIELD
-- e desfazia a transação inteira (pagamento e débito do saldo incluídos).
--
-- Corrige com um escape hatch local: a própria função liga uma flag de
-- sessão (app.bypass_partner_protection) só pra sua própria transação
-- logo antes do UPDATE privilegiado; o trigger passa a aceitar essa
-- flag também, além de admin/service_role. Testado: sem a flag continua
-- bloqueando normalmente (a proteção contra escrita direta do cliente
-- não foi enfraquecida); com a flag, só essa função consegue passar.
create or replace function public.protect_partners_privileged_columns()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.role() = 'service_role' or is_admin() or current_setting('app.bypass_partner_protection', true) = 'on' then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.approved_at is distinct from old.approved_at
    or new.is_advertiser is distinct from old.is_advertiser
    or new.advertiser_expires_at is distinct from old.advertiser_expires_at
    or new.requires_fee is distinct from old.requires_fee
    or new.asaas_subaccount_status is distinct from old.asaas_subaccount_status
    or new.asaas_wallet_id is distinct from old.asaas_wallet_id
    or new.asaas_account_id is distinct from old.asaas_account_id
    or new.asaas_subaccount_error is distinct from old.asaas_subaccount_error
  then
    raise exception 'CANNOT_CHANGE_PRIVILEGED_FIELD';
  end if;

  return new;
end;
$function$;

create or replace function public.pay_partner_fee_wallet()
 returns payments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_partner_id uuid;
  v_available numeric;
  v_payment payments;
  v_fee numeric := 149.90;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;

  select partner_id into v_partner_id from partner_staff where profile_id = auth.uid() limit 1;
  if v_partner_id is null then
    raise exception 'NOT_PARTNER_STAFF';
  end if;

  select available_balance(auth.uid()) into v_available;
  if coalesce(v_available, 0) < v_fee then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  insert into payments (subscriber_id, partner_id, amount, type, payment_method, status, confirmed_at, confirmed_by)
  values (auth.uid(), v_partner_id, v_fee, 'partner_fee', 'wallet', 'confirmed', now(), auth.uid())
  returning * into v_payment;

  insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
  values (auth.uid(), 'purchase', 'out', v_fee, current_wallet_balance(auth.uid()) - v_fee, 'payment', v_payment.id,
    'Taxa de anunciante Brinde Mais - pagamento com saldo interno');

  perform set_config('app.bypass_partner_protection', 'on', true);

  update partners set is_advertiser = true,
    advertiser_expires_at = greatest(coalesce(advertiser_expires_at, now()), now()) + interval '30 days',
    status = case when status in ('interested', 'pending_docs', 'analyzing') then 'approved'::partner_status else status end,
    approved_at = case when status in ('interested', 'pending_docs', 'analyzing') then now() else approved_at end
  where id = v_partner_id;

  perform award_referral_bonuses(auth.uid(), v_fee, 'partner_fee', v_payment.id);

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'payment', 'Você é Anunciante Brinde Mais!', 'Sua taxa de anunciante foi paga com seu saldo interno. Acesse a área de anunciante no seu painel.');

  return v_payment;
end;
$function$;
