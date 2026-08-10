-- Partners could create/edit their own promotions but never delete them —
-- promotions had select/insert/update policies but no delete policy at all.
create policy promotions_delete on promotions for delete using (is_admin() or is_partner_staff(partner_id));
