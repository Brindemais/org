-- Bug real: parceiro que escolheu um brinde do catálogo admin-curado
-- (products.partner_id fica null nesses casos — é um item compartilhado,
-- não exclusivo de um parceiro) trava a tela de Estoque. A policy de
-- leitura de products só liberava quando partner_id = o próprio parceiro;
-- pra item de catálogo isso nunca bate, então o embed
-- `product:product_id(...)` em stock_partner voltava null pro parceiro
-- (RLS bloqueando a linha referenciada), e o front acessava `.id` nesse
-- null sem guarda — tela preta.
--
-- Corrige os dois lados: a policy passa a liberar também quando o
-- parceiro tiver uma linha própria em stock_partner apontando pro
-- produto (mesmo sendo um item de catálogo sem partner_id); e o front
-- (src/pages/partner/Stock.tsx) ganha guarda contra product nulo, pra
-- nunca mais quebrar a tela mesmo se aparecer outro caso parecido.
drop policy if exists products_public_read on products;
create policy products_public_read on products for select using (
  is_admin()
  or (partner_id is not null and is_partner_staff(partner_id))
  or exists (select 1 from stock_partner sp where sp.product_id = products.id and is_partner_staff(sp.partner_id))
);
