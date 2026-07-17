-- ====================================================================
-- 0026 · 用户屏蔽
-- ====================================================================

create table if not exists user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references profiles(id) on delete cascade,
  blocked_user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_no_self_block check (blocker_user_id <> blocked_user_id)
);

create unique index if not exists user_blocks_pair_unique
  on user_blocks (blocker_user_id, blocked_user_id);

create index if not exists user_blocks_blocker_idx
  on user_blocks (blocker_user_id, created_at desc);

create index if not exists user_blocks_blocked_idx
  on user_blocks (blocked_user_id, created_at desc);

alter table user_blocks enable row level security;

create policy "user_blocks read own" on user_blocks
  for select using (auth.uid() = blocker_user_id);

create policy "user_blocks insert own" on user_blocks
  for insert with check (auth.uid() = blocker_user_id);

create policy "user_blocks delete own" on user_blocks
  for delete using (auth.uid() = blocker_user_id);
