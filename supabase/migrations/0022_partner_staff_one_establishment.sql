-- Each partner account can only run one establishment. partner_staff's
-- primary key was (partner_id, profile_id) — that only blocked the exact
-- same pair twice, not one profile_id being staff at two different
-- partner_id businesses. The frontend already assumed 1:1 (AuthContext
-- fetches with .maybeSingle()); this makes the database enforce it too.
alter table partner_staff add constraint partner_staff_profile_id_key unique (profile_id);
