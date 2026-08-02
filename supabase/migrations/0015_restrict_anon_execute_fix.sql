-- 0014 revoked EXECUTE from `anon` on these functions but verification just
-- now proved it was a no-op: `revoke ... from anon` does nothing while the
-- function is still executable via the standing `PUBLIC` grant that Postgres
-- attaches to every function at creation time (this exact trap was already
-- documented once in 0007 for the maintenance functions, and this migration
-- fell into it again). Confirmed live: after 0014, a role-simulated anon call
-- to cancel_subscription() still reached the function body instead of being
-- rejected. The only correct fix is revoking from PUBLIC directly, then
-- re-granting explicitly to authenticated (revoking from PUBLIC also strips
-- authenticated's implicit access, since authenticated inherits from PUBLIC
-- the same way anon does).
revoke execute on function admin_set_partner_status(uuid, partner_status) from public;
revoke execute on function admin_set_product_approval(uuid, boolean) from public;
revoke execute on function admin_set_promotion_status(uuid, promotion_status) from public;
revoke execute on function admin_set_subscriber_active(uuid, boolean) from public;
revoke execute on function available_balance(uuid) from public;
revoke execute on function award_referral_bonuses(uuid, numeric, text, uuid) from public;
revoke execute on function cancel_pickup_by_partner(uuid, text) from public;
revoke execute on function cancel_store_order(uuid) from public;
revoke execute on function cancel_subscription(uuid) from public;
revoke execute on function choose_pickup_partner(uuid, uuid) from public;
revoke execute on function complete_signup(text, text, date, text, text, text) from public;
revoke execute on function confirm_payment(uuid, uuid) from public;
revoke execute on function confirm_pickup_delivery(uuid, uuid, text, uuid) from public;
revoke execute on function confirm_pickup_delivery(uuid, uuid, text) from public;
revoke execute on function confirm_store_order_delivery(uuid) from public;
revoke execute on function current_wallet_balance(uuid) from public;
revoke execute on function get_my_data() from public;
revoke execute on function get_partner_pickups(uuid) from public;
revoke execute on function get_referral_tree(uuid) from public;
revoke execute on function list_authorized_persons_for_pickup(uuid) from public;
revoke execute on function matrix_stock_entry(uuid, integer, text) from public;
revoke execute on function partner_adjust_stock(uuid, uuid, integer, stock_movement_type, text) from public;
revoke execute on function pending_withdrawals_total(uuid) from public;
revoke execute on function process_withdrawal(uuid, withdrawal_status, text) from public;
revoke execute on function request_withdrawal(numeric, text) from public;
revoke execute on function transfer_stock_to_partner(uuid, uuid, integer, text) from public;

grant execute on function admin_set_partner_status(uuid, partner_status) to authenticated;
grant execute on function admin_set_product_approval(uuid, boolean) to authenticated;
grant execute on function admin_set_promotion_status(uuid, promotion_status) to authenticated;
grant execute on function admin_set_subscriber_active(uuid, boolean) to authenticated;
grant execute on function available_balance(uuid) to authenticated;
grant execute on function award_referral_bonuses(uuid, numeric, text, uuid) to authenticated;
grant execute on function cancel_pickup_by_partner(uuid, text) to authenticated;
grant execute on function cancel_store_order(uuid) to authenticated;
grant execute on function cancel_subscription(uuid) to authenticated;
grant execute on function choose_pickup_partner(uuid, uuid) to authenticated;
grant execute on function complete_signup(text, text, date, text, text, text) to authenticated;
grant execute on function confirm_payment(uuid, uuid) to authenticated;
grant execute on function confirm_pickup_delivery(uuid, uuid, text, uuid) to authenticated;
grant execute on function confirm_pickup_delivery(uuid, uuid, text) to authenticated;
grant execute on function confirm_store_order_delivery(uuid) to authenticated;
grant execute on function current_wallet_balance(uuid) to authenticated;
grant execute on function get_my_data() to authenticated;
grant execute on function get_partner_pickups(uuid) to authenticated;
grant execute on function get_referral_tree(uuid) to authenticated;
grant execute on function list_authorized_persons_for_pickup(uuid) to authenticated;
grant execute on function matrix_stock_entry(uuid, integer, text) to authenticated;
grant execute on function partner_adjust_stock(uuid, uuid, integer, stock_movement_type, text) to authenticated;
grant execute on function pending_withdrawals_total(uuid) to authenticated;
grant execute on function process_withdrawal(uuid, withdrawal_status, text) to authenticated;
grant execute on function request_withdrawal(numeric, text) to authenticated;
grant execute on function transfer_stock_to_partner(uuid, uuid, integer, text) to authenticated;
