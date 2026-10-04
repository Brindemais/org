-- Pivô de modelo: parceiro não cria mais brinde do zero, só escolhe do
-- catálogo que o admin disponibiliza (partner_id is null nas linhas de
-- `products` — já existia esse conceito de "produto central" sem dono,
-- usado antes por admin/Stock.tsx; agora também serve de catálogo pro
-- admin/cadastrar-brinde). Quando o parceiro escolhe um item, cria a
-- própria cópia (partner_id = ele) ligada de volta ao modelo original via
-- catalog_id, só pra UI saber "isso já está na minha vitrine" sem
-- depender de comparar nome.
--
-- RLS já cobre tudo isso sem mudança: products_public_read libera
-- is_admin() (cadastra o catálogo) e is_partner_staff(partner_id) (parceiro
-- lê/cria a própria cópia); a view products_public (sem filtro de
-- partner_id) já deixa qualquer authenticated ler os templates do
-- catálogo (partner_id is null, active, approved).
alter table products add column if not exists catalog_id uuid references products(id) on delete set null;
create index if not exists products_catalog_idx on products(catalog_id);
