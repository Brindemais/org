-- Allow anyone (no login required) to submit a partner interest lead.
-- Restricted to the 'interested' status so a public submission can never
-- self-approve or bypass the admin credenciamento flow in Partners.tsx.
create policy partners_public_interest on partners for insert
  with check (status = 'interested' and approved_at is null);
