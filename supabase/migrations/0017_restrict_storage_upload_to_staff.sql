-- Security audit finding: public_images_upload only checked bucket_id +
-- auth.role() = 'authenticated' — meaning ANY signed-up subscriber (trivial
-- to get via public self-signup) could POST arbitrary files into the public
-- 'public-images' bucket via the Storage API directly, even though the only
-- UI that uses this bucket (ImageUpload) is partner-only (logo, product
-- photos). The bucket is public-read by design (logos need to render on the
-- unauthenticated landing page), so an unrestricted INSERT meant anyone with
-- an account could get arbitrary content hosted under the platform's public
-- storage URLs. Tighten to match the existing UPDATE policy's role check:
-- admin or an actual partner-staff member, matching real usage.
drop policy if exists public_images_upload on storage.objects;
create policy public_images_upload on storage.objects for insert
  with check (
    bucket_id = 'public-images'
    and (is_admin() or exists (select 1 from partner_staff where profile_id = auth.uid()))
  );
