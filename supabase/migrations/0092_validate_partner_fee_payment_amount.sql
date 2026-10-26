-- A taxa de anunciante (partner_fee) não tinha NENHUMA validação de valor
-- no banco, diferente da assinatura (que já trava 149.90/1439.04 desde a
-- 0028/0044). Como a política de INSERT em payments só exige
-- status='pending' + is_active_subscriber() (sem restringir o valor),
-- qualquer parceiro autenticado podia inserir um payments type='partner_fee'
-- com amount arbitrário (ex: R$0,01) direto pela API, gerar um Pix/cartão
-- REAL pra esse valor, pagar, e confirm_payment() liberaria o status de
-- anunciante completo (30 dias) + bônus de indicação mesmo assim.
create or replace function validate_subscription_payment() returns trigger language plpgsql set search_path = public as $f$
begin
  if new.type = 'subscription' then
    if new.plan is null then
      new.plan := 'monthly';
    end if;
    if new.plan = 'monthly' and new.amount <> 149.90 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
    if new.plan = 'annual' and new.amount <> 1439.04 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
  elsif new.type = 'partner_fee' and new.amount <> 149.90 then
    raise exception 'INVALID_PLAN_AMOUNT';
  end if;
  return new;
end;
$f$;
