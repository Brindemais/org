-- Supabase's linter flags every SECURITY DEFINER function granted to `anon`
-- as a WARN ("Public Can Execute SECURITY DEFINER Function"), because such a
-- function runs with elevated privileges regardless of who calls it. All of
-- the functions below already self-check auth.uid()/is_admin()/is_partner_staff()
-- internally, so an anon caller was never able to do anything with them
-- (auth.uid() is null for anon, so ownership checks fail and ends in
-- NOT_AUTHORIZED or a failed not-null insert). But "harmless if called" isn't
-- the same as "should be callable" — every real call site for these is a
-- .rpc() from an authenticated dashboard route (subscriber/partner/admin),
-- confirmed by grepping src/ for each function name. So this tightens least-
-- privilege for real: anon can no longer even attempt these, which also
-- silences 26 of the 30 anon_security_definer_function_executable warnings.
--
-- NOT touched here: is_admin(), is_partner_staff(uuid), is_active_subscriber(),
-- is_partner_order(uuid). Those four are called *inside* RLS USING clauses
-- for tables the public landing page reads while logged out (partners,
-- products, promotions — e.g. `status in ('approved','active') or
-- is_partner_staff(id)`). Postgres does not guarantee OR short-circuit
-- evaluation order for RLS predicates, so revoking anon's EXECUTE on these
-- could turn "0 rows" into "permission denied for function is_partner_staff"
-- for anonymous visitors browsing the site — a real regression, not just a
-- cosmetic lint. The remaining anon_* and all 30 authenticated_* warnings for
-- these functions are accepted as inherent to this project's RPC pattern.

revoke execute on function admin_set_partner_status(uuid, partner_status) from anon;
revoke execute on function admin_set_product_approval(uuid, boolean) from anon;
revoke execute on function admin_set_promotion_status(uuid, promotion_status) from anon;
revoke execute on function admin_set_subscriber_active(uuid, boolean) from anon;
revoke execute on function available_balance(uuid) from anon;
revoke execute on function award_referral_bonuses(uuid, numeric, text, uuid) from anon;
revoke execute on function cancel_pickup_by_partner(uuid, text) from anon;
revoke execute on function cancel_store_order(uuid) from anon;
revoke execute on function cancel_subscription(uuid) from anon;
revoke execute on function choose_pickup_partner(uuid, uuid) from anon;
revoke execute on function complete_signup(text, text, date, text, text, text) from anon;
revoke execute on function confirm_payment(uuid, uuid) from anon;
revoke execute on function confirm_pickup_delivery(uuid, uuid, text, uuid) from anon;
revoke execute on function confirm_pickup_delivery(uuid, uuid, text) from anon;
revoke execute on function confirm_store_order_delivery(uuid) from anon;
revoke execute on function current_wallet_balance(uuid) from anon;
revoke execute on function get_my_data() from anon;
revoke execute on function get_partner_pickups(uuid) from anon;
revoke execute on function get_referral_tree(uuid) from anon;
revoke execute on function list_authorized_persons_for_pickup(uuid) from anon;
revoke execute on function matrix_stock_entry(uuid, integer, text) from anon;
revoke execute on function partner_adjust_stock(uuid, uuid, integer, stock_movement_type, text) from anon;
revoke execute on function pending_withdrawals_total(uuid) from anon;
revoke execute on function process_withdrawal(uuid, withdrawal_status, text) from anon;
revoke execute on function request_withdrawal(numeric, text) from anon;
revoke execute on function transfer_stock_to_partner(uuid, uuid, integer, text) from anon;
