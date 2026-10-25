-- ===============================================================
-- GRAPE TREE v16: PROTECT THE DESIGN-FILE STORAGE  (safe to run more than once)
-- Only pictures up to 20 MB can be uploaded to the customer design folder,
-- so nobody can fill it with other files.
-- Run it in Supabase: SQL Editor -> New query -> paste -> Run.
-- ===============================================================
update storage.buckets
   set file_size_limit = 20971520,
       allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','application/json']
 where id = 'order-art';
