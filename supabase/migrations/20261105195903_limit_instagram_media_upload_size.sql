-- Keep media uploads within the currently provisioned storage tier.
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'instagram-media';
