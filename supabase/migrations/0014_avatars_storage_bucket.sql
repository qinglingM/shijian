-- ====================================================================
-- 0014 · avatars Storage Bucket + RLS
-- 用户头像存储桶，public 可读，仅本人可写
-- ====================================================================

-- 创建 avatars bucket（public 可读）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,   -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- RLS: 任何人可读（public bucket 已默认，这里显式加上）
-- ----------------------------------------------------------------
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- ----------------------------------------------------------------
-- RLS: 登录用户只能上传/覆盖自己目录下的文件
-- 路径约定：{user_id}/avatar.{ext}
-- ----------------------------------------------------------------
create policy "avatars: owner upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
