-- Fix: replacing a photo uses "upsert", which also needs a SELECT policy on storage.objects.
-- Each user can see only their own files; the photos themselves stay publicly viewable through the bucket's public URL.
create policy "avatars: read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
