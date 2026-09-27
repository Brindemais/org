-- TEMPORÁRIO — teste real em produção com valor de R$ 1 em vez do preço
-- normal (mensal 149,90 / anual 1439,04), a pedido do dono da plataforma
-- pra validar o fluxo de Pix/cartão com dinheiro de verdade sem cobrar o
-- valor cheio. Revertida pela migração seguinte assim que o teste acabar.
create or replace function validate_subscription_payment() returns trigger language plpgsql set search_path = public as $$
begin
  if new.type = 'subscription' then
    if new.plan is null then
      new.plan := 'monthly';
    end if;
    if new.plan = 'monthly' and new.amount <> 1.00 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
    if new.plan = 'annual' and new.amount <> 1.00 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
  end if;
  return new;
end;
$$;
