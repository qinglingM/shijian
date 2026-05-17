-- ====================================================================
-- 0014 · 用户关注系统与主页可见性
-- ====================================================================

alter table profiles
  add column if not exists is_profile_public boolean not null default true;

create table if not exists user_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_no_self_follow check (follower_id <> following_id),
  constraint user_follows_unique unique (follower_id, following_id)
);

create index if not exists idx_user_follows_follower on user_follows (follower_id, created_at desc);
create index if not exists idx_user_follows_following on user_follows (following_id, created_at desc);

alter table user_follows enable row level security;

create policy "follows read own or public profile" on user_follows
  for select using (
    auth.uid() = follower_id
    or auth.uid() = following_id
  );

create policy "follows insert own" on user_follows
  for insert with check (
    auth.uid() = follower_id
    and auth.uid() = following_id
  );

create policy "follows delete own" on user_follows
  for delete using (auth.uid() = follower_id);

create policy "profiles public read only when enabled" on profiles
  for select using (
    id = auth.uid()
    or coalesce(is_profile_public, true)
  );

update profiles set is_profile_public = coalesce(is_profile_public, true);
