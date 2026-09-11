-- ============================================================
-- Vazamento real encontrado nesta auditoria: RLS restringe LINHAS,
-- não COLUNAS. A policy partners_public_read liberava qualquer linha
-- de parceiro aprovado/ativo para o role `anon` (visitante sem login)
-- — mas sem restrição de coluna, então um select('*') direto na API
-- REST (com a chave anon pública, embutida no bundle do site)
-- devolvia CNPJ, nome do responsável, telefone pessoal, WhatsApp,
-- e-mail e endereço de TODO parceiro aprovado. Confirmado rodando a
-- query como o role anon de verdade antes deste fix.
--
-- O mesmo valia para products: discount_pct/subscriber_discount_pct
-- (a margem negociada com o fornecedor da regra de precificação) já
-- saíam liberados no mesmo select('*') público — hoje ainda zerados
-- em todo produto existente, mas teria vazado assim que um fornecedor
-- real usasse a regra.
--
-- Fix: duas views (`partners_public`, `products_public`) só com as
-- colunas que o site/app realmente mostram publicamente, e a policy
-- de leitura pública da tabela base passa a exigir is_admin() ou
-- is_partner_staff — ou seja, a tabela base não abre mais linha
-- nenhuma pra fora de admin/dono do parceiro; todo o resto (site
-- público, telas do assinante) passa a ler pela view.
-- ============================================================

create view partners_public with (security_barrier = true) as
select id, trade_name, category, neighborhood, city, state, address, opening_hours, logo_url, whatsapp, lat, lng, status, rating
from partners
where status in ('approved', 'active');

grant select on partners_public to anon, authenticated;

drop policy partners_public_read on partners;
create policy partners_public_read on partners for select using (is_admin() or is_partner_staff(id));

create view products_public with (security_barrier = true) as
select id, partner_id, name, description, image_url, category, normal_price, subscriber_price, is_gift, store_visible, active, approved, created_at
from products
where active = true and approved = true;

grant select on products_public to anon, authenticated;

drop policy products_public_read on products;
create policy products_public_read on products for select using (
  is_admin() or (partner_id is not null and is_partner_staff(partner_id))
);
