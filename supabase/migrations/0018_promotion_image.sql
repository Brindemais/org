-- Promotions can now carry a photo, same as products. Partners upload it
-- through the same public-images bucket already used for product photos.
alter table promotions add column image_url text;
