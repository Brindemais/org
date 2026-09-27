-- ============================================================
-- asaas_customer_id era uma coluna única, reaproveitada direto pela Edge
-- Function sempre que já existia um valor — mas sandbox e produção são
-- contas Asaas completamente separadas, com IDs de cliente que não têm
-- nada a ver entre si. No primeiro teste real em produção, o customer_id
-- gravado durante os testes em sandbox foi reenviado pra API de produção,
-- que corretamente recusou ("Customer inválido ou não informado").
--
-- Separa por ambiente pra nunca mais misturar: o valor existente (criado
-- durante os testes) vira o de sandbox; produção nasce vazia e é
-- preenchida no primeiro pagamento real de cada pessoa.
-- ============================================================

alter table profiles
  add column if not exists asaas_customer_id_sandbox text,
  add column if not exists asaas_customer_id_production text;

update profiles set asaas_customer_id_sandbox = asaas_customer_id where asaas_customer_id is not null;

alter table profiles drop column if exists asaas_customer_id;
