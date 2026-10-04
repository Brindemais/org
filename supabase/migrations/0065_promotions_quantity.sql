-- "Produtos e descontos" (promotions) ganha quantidade em estoque,
-- informada pelo parceiro na hora de cadastrar — mesmo princípio dos
-- brindes: só o parceiro mexe em quantidade, nunca o admin.
alter table promotions add column if not exists quantity integer not null default 0 check (quantity >= 0);
