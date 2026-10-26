-- Permite o parceiro pagar a taxa de anunciante (R$149,90) com o próprio
-- saldo interno, em vez de só via Pix Asaas — mesmo padrão de confirmação
-- imediata já usado em create_product_order pro pagamento com saldo (sem
-- passar pelo fluxo assíncrono de confirm_payment, que é restrito a
-- admin/service_role).
create or replace function pay_partner_fee_wallet()
returns payments
language plpgsql
security definer
set search_path to 'public'
as $f$
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

  update partners set is_advertiser = true,
    advertiser_expires_at = greatest(coalesce(advertiser_expires_at, now()), now()) + interval '30 days'
  where id = v_partner_id;

  perform award_referral_bonuses(auth.uid(), v_fee, 'partner_fee', v_payment.id);

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'payment', 'Você é Anunciante Brinde Mais!', 'Sua taxa de anunciante foi paga com seu saldo interno. Acesse a área de anunciante no seu painel.');

  return v_payment;
end;
$f$;

revoke all on function pay_partner_fee_wallet() from public;
revoke all on function pay_partner_fee_wallet() from anon;
grant execute on function pay_partner_fee_wallet() to authenticated;
