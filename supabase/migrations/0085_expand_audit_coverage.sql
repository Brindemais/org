-- Amplia a auditoria: hoje só ações financeiras diretas (pagamento, saldo,
-- saque, status de parceiro/promoção/assinante) ficam registradas. Faltava
-- edição de perfil, convite de parceiro/staff, remoção de cadastro
-- pendente, mudança de comissão e login — nenhuma dessas deixava rastro.

-- Login: toda vez que alguém entra, o próprio front chama essa função logo
-- após o auth.onAuthStateChange(SIGNED_IN). Só grava o próprio login de
-- quem chama (auth.uid()) — não precisa checagem de admin, qualquer
-- usuário pode logar a própria entrada.
create or replace function log_login_event()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into audit_logs (actor_id, action, entity, entity_id)
  values (auth.uid(), 'login', 'auth', auth.uid());
end;
$$;

-- Mudança de comissão/categoria de parceiro feita pelo admin (hoje é um
-- UPDATE direto na tabela, sem RPC própria) — trigger pega a mudança no
-- nível do banco em vez de depender de cada tela lembrar de logar.
-- Ignora mudança feita por service_role (webhook da Asaas mexendo em
-- outros campos da mesma linha) e só grava se quem mudou é admin.
create or replace function log_partner_commission_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if is_admin() and (new.commission_pct is distinct from old.commission_pct or new.category is distinct from old.category) then
    insert into audit_logs (actor_id, action, entity, entity_id, before, after)
    values (auth.uid(), 'set_partner_commission', 'partners', new.id,
      jsonb_build_object('commission_pct', old.commission_pct, 'category', old.category),
      jsonb_build_object('commission_pct', new.commission_pct, 'category', new.category));
  end if;
  return new;
end;
$$;

drop trigger if exists partners_audit_commission on partners;
create trigger partners_audit_commission
after update on partners
for each row execute function log_partner_commission_change();
