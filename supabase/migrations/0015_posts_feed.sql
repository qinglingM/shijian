-- ====================================================================
-- 0015 · 广场帖子与统一有品投票
-- ====================================================================

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  post_type text not null check (post_type in ('practice', 'article')),
  title text not null,
  content text not null default '',
  cover_image_url text null,
  practice_record_id uuid null references practice_records(id) on delete set null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posts_created_at on posts (created_at desc);
create index if not exists idx_posts_user_id on posts (user_id, created_at desc);
create index if not exists idx_posts_practice_record_id on posts (practice_record_id);

alter table posts enable row level security;

create policy "posts public read" on posts
  for select using (is_public = true or auth.uid() = user_id);

create policy "posts insert own" on posts
  for insert with check (auth.uid() = user_id);

create policy "posts update own" on posts
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posts delete own" on posts
  for delete using (auth.uid() = user_id);

alter table review_votes
  drop constraint if exists review_votes_target_type_check;

alter table review_votes
  add constraint review_votes_target_type_check
  check (target_type in ('store_review', 'dish_review', 'post'));
