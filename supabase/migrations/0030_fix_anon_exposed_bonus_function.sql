-- ============================================================
-- Auditoria de segurança pós-deploy da regra de fornecedor (0029):
-- criar o novo overload de 5 parâmetros de award_referral_bonuses via
-- CREATE OR REPLACE gerou uma função nova (assinatura diferente = nova
-- identidade de função no Postgres), que herdou o grant PUBLIC padrão
-- em vez do revoke de anon/public que o overload de 4 parâmetros já
-- tinha (migrations 0014/0015). Isso deixou uma função SECURITY
-- DEFINER que credita saldo de carteira exposta para qualquer visitante
-- não autenticado via /rest/v1/rpc/award_referral_bonuses.
--
-- Corrigido em produção assim que encontrado nesta auditoria. Este
-- arquivo só registra o fix já aplicado.
-- ============================================================

revoke execute on function award_referral_bonuses(uuid, numeric, text, uuid, uuid) from public;
revoke execute on function award_referral_bonuses(uuid, numeric, text, uuid, uuid) from anon;
grant execute on function award_referral_bonuses(uuid, numeric, text, uuid, uuid) to authenticated;

-- Item de higiene apontado pelo linter de segurança do Supabase:
-- validate_subscription_payment (trigger de validação de preço) não
-- fixava search_path. Sem exposição real (função de trigger, não é
-- endpoint RPC), mas corrigido junto.
create or replace function validate_subscription_payment() returns trigger language plpgsql set search_path = public as $$
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
  end if;
  return new;
end;
$$;
