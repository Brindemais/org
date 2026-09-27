-- Mesmo problema do asaas_customer_id (migração 0039), agora pro token de
-- cartão tokenizado: sandbox e produção não compartilham token nenhum.
alter table profiles
  add column if not exists asaas_card_token_sandbox text,
  add column if not exists asaas_card_token_production text;

update profiles set asaas_card_token_sandbox = asaas_card_token where asaas_card_token is not null;

alter table profiles drop column if exists asaas_card_token;
