-- ====================================================================
-- 0003 · 标记 / 伯乐 / 有品野榜投票
-- ====================================================================
-- 这些是「治理 / 激励」层的表，依赖主链路。
-- 「已评价」状态不入 marks 表，由 practice_records 推导。
-- ====================================================================

-- ----------------------------------------------------------------
-- marks · 标记（仅存主动标记 = 想去）
-- ----------------------------------------------------------------
create table marks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

create index marks_user_idx on marks (user_id);

-- ----------------------------------------------------------------
-- bole_records · 伯乐（首位有效实践者）
-- ----------------------------------------------------------------
create table bole_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles (id) on delete cascade,
  restaurant_id       uuid not null references restaurants (id) on delete cascade,
  practice_record_id  uuid not null references practice_records (id) on delete cascade,
  is_active           boolean not null default true,
  awarded_at          timestamptz not null default now()
);

-- 一个餐厅同时最多一个有效伯乐
create unique index bole_records_unique_active
  on bole_records (restaurant_id)
  where is_active = true;

create index bole_records_user_idx     on bole_records (user_id);
create index bole_records_practice_idx on bole_records (practice_record_id);

-- ----------------------------------------------------------------
-- review_votes · 有品 / 野榜
-- ----------------------------------------------------------------
create table review_votes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  target_type  vote_target not null,
  target_id    uuid not null,
  vote_type    vote_type not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- 同一用户对同一评价目标只能投一次
  unique (user_id, target_type, target_id)
);

create trigger review_votes_set_updated_at
  before update on review_votes
  for each row execute function public.set_updated_at();

create index review_votes_target_idx on review_votes (target_type, target_id);
create index review_votes_user_idx   on review_votes (user_id);
