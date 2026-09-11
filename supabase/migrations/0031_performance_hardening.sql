-- ============================================================
-- Auditoria: itens de performance apontados pelo linter de segurança/
-- performance do Supabase (nenhum era crítico, mas ficam mais baratos
-- em escala). Nada aqui muda comportamento visível — só performance.
-- ============================================================

-- ------------------------------------------------------------
-- 1) RLS: troca auth.uid() direto por (select auth.uid()) nas
--    policies que comparavam contra ele — vira um initplan avaliado
--    uma vez por query em vez de recalculado linha a linha.
-- ------------------------------------------------------------
alter policy profiles_select_own on profiles using ((id = (select auth.uid())) or is_admin());
alter policy profiles_update_own on profiles using ((id = (select auth.uid())) or is_admin());
alter policy profiles_insert_self on profiles with check (id = (select auth.uid()));

alter policy partner_staff_select on partner_staff using ((profile_id = (select auth.uid())) or is_admin());

alter policy subscriptions_select on subscriptions using ((subscriber_id = (select auth.uid())) or is_admin());

alter policy payments_select on payments using ((subscriber_id = (select auth.uid())) or is_admin());
alter policy payments_insert on payments with check (
  is_admin() or ((subscriber_id = (select auth.uid())) and (status = 'pending'::payment_status) and is_active_subscriber())
);

alter policy authorized_persons_owner on authorized_persons
  using ((subscriber_id = (select auth.uid())) or is_admin())
  with check ((subscriber_id = (select auth.uid())) or is_admin());

alter policy pickups_select on pickups using ((subscriber_id = (select auth.uid())) or is_admin() or is_partner_staff(partner_id));

alter policy referrals_select on referrals using ((referrer_id = (select auth.uid())) or (referred_id = (select auth.uid())) or is_admin());

alter policy bonuses_select on bonuses using ((beneficiary_id = (select auth.uid())) or is_admin());

alter policy wallet_select on wallet_transactions using ((user_id = (select auth.uid())) or is_admin());

alter policy withdrawals_select on withdrawals using ((user_id = (select auth.uid())) or is_admin());

alter policy store_orders_insert on store_orders with check (
  is_admin() or ((subscriber_id = (select auth.uid())) and (status = 'pending_payment'::order_status) and is_active_subscriber())
);

alter policy store_order_items_insert on store_order_items with check (
  exists (select 1 from store_orders o where o.id = store_order_items.order_id and o.subscriber_id = (select auth.uid()))
);

alter policy tickets_select on support_tickets using ((user_id = (select auth.uid())) or is_admin());
alter policy tickets_insert on support_tickets with check (user_id = (select auth.uid()));
alter policy tickets_update on support_tickets using ((user_id = (select auth.uid())) or is_admin());

alter policy messages_select on support_messages using (
  exists (select 1 from support_tickets t where t.id = support_messages.ticket_id and (t.user_id = (select auth.uid()) or is_admin()))
);
alter policy messages_insert on support_messages with check (
  (sender_id = (select auth.uid()))
  and exists (select 1 from support_tickets t where t.id = support_messages.ticket_id and (t.user_id = (select auth.uid()) or is_admin()))
);

alter policy notifications_select on notifications using (user_id = (select auth.uid()));
alter policy notifications_update on notifications using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- 2) RLS: junta policies permissivas duplicadas na mesma tabela/ação
--    (o Postgres já as combina com OR, mas avalia as duas — uma só
--    fica mais barata). store_order_items_partner_select era
--    redundante com o branch de parceiro que store_order_items_select
--    já tinha, então só cai fora.
-- ------------------------------------------------------------
drop policy partners_admin_write on partners;
drop policy partners_public_interest on partners;
create policy partners_insert on partners for insert with check (
  is_admin() or (status = 'interested'::partner_status and approved_at is null)
);

drop policy stock_partner_public_avail on stock_partner;
drop policy stock_partner_select on stock_partner;
create policy stock_partner_select on stock_partner for select using (
  (quantity > 0) or is_partner_staff(partner_id) or is_admin()
);

drop policy store_order_items_partner_select on store_order_items;
drop policy store_order_items_select on store_order_items;
create policy store_order_items_select on store_order_items for select using (
  (exists (select 1 from store_orders o where o.id = store_order_items.order_id and (o.subscriber_id = (select auth.uid()) or is_admin())))
  or (partner_id is not null and is_partner_staff(partner_id))
);

drop policy store_orders_partner_select on store_orders;
drop policy store_orders_select on store_orders;
create policy store_orders_select on store_orders for select using (
  (subscriber_id = (select auth.uid())) or is_admin() or is_partner_order(id)
);

-- ------------------------------------------------------------
-- 3) Índices cobrindo chaves estrangeiras sem índice (evita full scan
--    em updates/deletes na tabela referenciada e em joins comuns).
-- ------------------------------------------------------------
create index if not exists audit_logs_actor_id_idx on audit_logs(actor_id);
create index if not exists authorized_persons_subscriber_id_idx on authorized_persons(subscriber_id);
create index if not exists bonuses_source_subscriber_id_idx on bonuses(source_subscriber_id);
create index if not exists partner_change_requests_partner_id_idx on partner_change_requests(partner_id);
create index if not exists partner_change_requests_requested_by_idx on partner_change_requests(requested_by);
create index if not exists partner_change_requests_reviewed_by_idx on partner_change_requests(reviewed_by);
create index if not exists payments_confirmed_by_idx on payments(confirmed_by);
create index if not exists payments_order_id_idx on payments(order_id);
create index if not exists payments_subscription_id_idx on payments(subscription_id);
create index if not exists pickups_authorized_person_id_idx on pickups(authorized_person_id);
create index if not exists pickups_confirmed_by_idx on pickups(confirmed_by);
create index if not exists pickups_product_id_idx on pickups(product_id);
create index if not exists pickups_subscription_id_idx on pickups(subscription_id);
create index if not exists stock_movements_responsible_id_idx on stock_movements(responsible_id);
create index if not exists stock_partner_product_id_idx on stock_partner(product_id);
create index if not exists store_order_items_order_id_idx on store_order_items(order_id);
create index if not exists store_order_items_partner_id_idx on store_order_items(partner_id);
create index if not exists store_order_items_product_id_idx on store_order_items(product_id);
create index if not exists store_orders_payment_id_idx on store_orders(payment_id);
create index if not exists store_orders_subscriber_id_idx on store_orders(subscriber_id);
create index if not exists support_messages_sender_id_idx on support_messages(sender_id);
create index if not exists support_messages_ticket_id_idx on support_messages(ticket_id);
create index if not exists support_tickets_user_id_idx on support_tickets(user_id);
create index if not exists withdrawals_processed_by_idx on withdrawals(processed_by);

-- ------------------------------------------------------------
-- 4) pg_net: o linter aponta a extensão registrada no schema public.
--    Tentado mover para `extensions` (mesmo schema de pgcrypto/
--    uuid-ossp aqui), mas o Postgres recusa: "extension pg_net does
--    not support SET SCHEMA" (não é relocatable). As funções dela
--    (net.http_post etc.) já vivem isoladas no schema `net` de
--    qualquer forma — não há função nem tabela exposta em public por
--    causa disso, só o registro da extensão. Mover exigiria dropar e
--    recriar a extensão (perde o histórico de requisições em
--    net._http_response e arrisca o cron job de lembrete de renovação
--    no meio do caminho) — não vale o risco para um WARN cosmético.
--    Deixado como está.
-- ------------------------------------------------------------
