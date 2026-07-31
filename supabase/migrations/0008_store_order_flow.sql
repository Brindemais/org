-- Loja: parceiro não tinha visibilidade nenhuma dos pedidos com itens dele
-- (nenhuma policy de select), e não existia como confirmar retirada nem
-- cancelar um pedido. Fecha esse ciclo: parceiro confirma entrega (baixa
-- estoque na hora da confirmação, igual ao brinde mensal), assinante cancela
-- enquanto o pedido ainda não foi entregue.

create policy store_orders_partner_select on store_orders for select using (
  exists (select 1 from store_order_items i where i.order_id = store_orders.id and is_partner_staff(i.partner_id))
);
create policy store_order_items_partner_select on store_order_items for select using (is_partner_staff(partner_id));

create or replace function confirm_store_order_delivery(p_order_id uuid) returns store_orders language plpgsql security definer set search_path = public as $$
declare
  v_order store_orders;
  v_item record;
  v_qty int;
  v_touched boolean := false;
begin
  select * into v_order from store_orders where id = p_order_id;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'paid' then raise exception 'ORDER_NOT_READY'; end if;

  for v_item in select * from store_order_items where order_id = p_order_id loop
    if v_item.partner_id is not null and is_partner_staff(v_item.partner_id) then
      v_touched := true;
      select quantity into v_qty from stock_partner where partner_id = v_item.partner_id and product_id = v_item.product_id for update;
      if v_qty is null or v_qty < v_item.quantity then raise exception 'NO_STOCK'; end if;

      update stock_partner set quantity = quantity - v_item.quantity where partner_id = v_item.partner_id and product_id = v_item.product_id;
      insert into stock_movements (product_id, partner_id, type, quantity, prior_balance, new_balance, reason, responsible_id, reference_id)
      values (v_item.product_id, v_item.partner_id, 'delivery', -v_item.quantity, v_qty, v_qty - v_item.quantity, 'Pedido da loja entregue', auth.uid(), p_order_id);
    end if;
  end loop;

  if not v_touched then raise exception 'NOT_AUTHORIZED'; end if;

  update store_orders set status = 'completed' where id = p_order_id returning * into v_order;
  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Pedido entregue', 'Seu pedido na loja Brinde Mais foi retirado com sucesso.');

  return v_order;
end;
$$;

create or replace function cancel_store_order(p_order_id uuid) returns store_orders language plpgsql security definer set search_path = public as $$
declare v_order store_orders;
begin
  select * into v_order from store_orders where id = p_order_id;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.subscriber_id <> auth.uid() and not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if v_order.status not in ('pending_payment','paid') then raise exception 'ORDER_CANNOT_BE_CANCELLED'; end if;

  update store_orders set status = 'cancelled' where id = p_order_id returning * into v_order;
  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Pedido cancelado', 'Seu pedido na loja Brinde Mais foi cancelado.');

  return v_order;
end;
$$;
