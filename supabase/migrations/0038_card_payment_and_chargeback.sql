-- ============================================================
-- 1) Bug ao vivo encontrado ao investigar o pedido de cartão/estorno:
-- confirm_payment() (dispara em toda confirmação de assinatura/loja/taxa
-- de anunciante, tanto manual quanto pelo webhook da Asaas) sempre chama
-- award_referral_bonuses com exatamente 4 argumentos posicionais. Como um
-- overload antigo de 4 argumentos (de antes do corte de 7 para 4 níveis
-- na migração 0034) continuava existindo ao lado do overload atual de 5
-- argumentos, a resolução de overload do Postgres (que prioriza
-- correspondência exata de aridade sobre usar um default) escolhia
-- silenciosamente a versão velha de 7 níveis em toda essa chamada — a
-- mesma regra de negócio de "caiu de 7 para 4 níveis" nunca valeu pra
-- bonificação de assinatura/consumo de loja/taxa, só pra retirada de
-- brinde de fornecedor (confirm_pickup_delivery já chama a versão de 5
-- argumentos explicitamente). Checado: nenhuma bonificação de nível 5-7
-- chegou a ser paga por esse caminho ainda (nenhuma cadeia de indicação
-- testada foi funda o suficiente), mas o bug estava ativo. Removendo o
-- overload morto, as chamadas de 4 argumentos passam a resolver pro
-- overload de 5 (p_origin_pickup_id usa o default null) sem precisar
-- tocar em confirm_payment nem em nenhum outro call site.
drop function if exists award_referral_bonuses(uuid, numeric, text, uuid);

-- ============================================================
-- 2) Pagamento por cartão no plano anual + controle de estorno.
--
-- Regra: mensal só Pix (nunca muda); anual pode Pix ou cartão. Cartão usa
-- tokenização da Asaas (POST /v3/creditCard/tokenize) — o formulário fica
-- na nossa página, mas o número/CVV passam direto (TLS) pela Edge
-- Function até a Asaas e nunca são gravados no banco, só o token que ela
-- devolve, reaproveitável nas cobranças seguintes da mesma pessoa.
-- ============================================================

alter table payments
  add column if not exists payment_method text not null default 'pix'
    check (payment_method in ('pix','credit_card'));

alter table profiles
  add column if not exists asaas_card_token text,
  add column if not exists asaas_card_last4 text,
  add column if not exists asaas_card_brand text;

-- Cartão é aprovado/recusado na hora (diferente do Pix, que é assíncrono),
-- mas a Asaas pode ainda assim estornar depois (contestação do titular,
-- chargeback da bandeira). mark_payment_chargeback() é o espelho de
-- confirm_payment(): desfaz exatamente o que aquela função tinha liberado
-- — suspende a assinatura (perde o acesso na hora, não espera vencer),
-- tira o selo de anunciante, e estorna qualquer bonificação de indicação
-- que aquele pagamento tinha disparado, debitando a carteira de quem
-- recebeu (nunca apaga o lançamento original — lança um "reversal" novo,
-- igual todo o resto da carteira já funciona só por lançamento).
create or replace function mark_payment_chargeback(p_payment_id uuid) returns payments
language plpgsql security definer set search_path = public as $$
declare
  v_payment payments;
  v_bonus record;
  v_balance numeric;
begin
  if not (is_admin() or auth.role() = 'service_role') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update payments set status = 'refunded' where id = p_payment_id and status = 'confirmed'
  returning * into v_payment;

  if v_payment.id is null then
    select * into v_payment from payments where id = p_payment_id;
    return v_payment;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'mark_payment_chargeback', 'payments', v_payment.id, jsonb_build_object('amount', v_payment.amount, 'type', v_payment.type));

  if v_payment.type = 'subscription' then
    if v_payment.subscription_id is not null then
      update subscriptions set status = 'suspended', expires_at = now()
      where id = v_payment.subscription_id;
    end if;
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Pagamento estornado',
      'O pagamento da sua assinatura foi estornado pela operadora do cartão e o acesso foi suspenso. Entre em contato com o suporte para regularizar.');
  elsif v_payment.type = 'partner_fee' then
    update partners set is_advertiser = false where id = v_payment.partner_id;
  end if;

  for v_bonus in select * from bonuses where origin_payment_id = p_payment_id and status = 'confirmed' loop
    select current_wallet_balance(v_bonus.beneficiary_id) - v_bonus.amount into v_balance;
    insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
    values (v_bonus.beneficiary_id, 'reversal', 'out', v_bonus.amount, v_balance, 'payment', p_payment_id,
      'Estorno de bonificação (nível ' || v_bonus.level || ') - pagamento estornado pela operadora do cartão');
    update bonuses set status = 'reversed' where id = v_bonus.id;
  end loop;

  return v_payment;
end;
$$;

revoke execute on function mark_payment_chargeback(uuid) from public, anon;
grant execute on function mark_payment_chargeback(uuid) to authenticated;
