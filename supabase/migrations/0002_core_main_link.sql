-- ====================================================================
-- 0002 · 主链路实体
-- profiles / restaurants / practice_records / dishes / dish_reviews
-- ====================================================================
-- 这五张表构成「用户搜索 → 提交实践 → 餐厅入库 → 菜品评价」的完整主链路。
-- 其它治理表（marks / bole / votes / guidance）放在 0003、0004。
-- ====================================================================

-- ----------------------------------------------------------------
-- profiles · 用户资料
-- profiles.id == auth.users.id
-- ----------------------------------------------------------------
create table profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  user_code         text not null unique,
  nickname          text not null,
  avatar_url        text,
  bio               text,
  city_id           uuid references cities (id) on delete set null,
  district_id       uuid references districts (id) on delete set null,
  current_title_id  uuid, -- references user_titles(id)，0004 后建外键
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

create index profiles_city_idx on profiles (city_id);

-- 新用户注册时自动生成 profile（user_code 取 uuid 前 6 个 hex 字符）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, user_code, nickname)
  values (
    new.id,
    'SJ' || upper(substring(replace(new.id::text, '-', '') from 1 for 6)),
    coalesce(
      nullif(new.raw_user_meta_data->>'nickname', ''),
      '食鉴用户'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------
-- restaurants · 食鉴正式餐厅库
-- 只有完成有效实践后才正式入库（由 Edge Function 写入）
-- ----------------------------------------------------------------
create table restaurants (
  id                uuid primary key default gen_random_uuid(),
  poi_source        poi_source not null,
  poi_id            text,
  poi_name          text,
  brand_name        text not null,
  branch_name       text,
  display_name      text not null,
  address_text      text,
  location_hint     text,
  latitude          numeric(9, 6),
  longitude         numeric(9, 6),
  province_name     text,
  city_name         text,
  district_name     text,
  city_id           uuid references cities (id) on delete set null,
  district_id       uuid references districts (id) on delete set null,
  category_id       uuid references categories (id) on delete set null,
  cover_image_url   text,
  created_by        uuid not null references profiles (id) on delete restrict,
  status            restaurant_status not null default 'active',
  merged_to_id      uuid references restaurants (id) on delete set null,
  search_text       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger restaurants_set_updated_at
  before update on restaurants
  for each row execute function public.set_updated_at();

-- 高德 POI 不允许重复入库（手动店 poi_id 为 null，可重复）
create unique index restaurants_poi_unique
  on restaurants (poi_source, poi_id)
  where poi_id is not null;

create index restaurants_status_idx     on restaurants (status);
create index restaurants_city_idx       on restaurants (city_id);
create index restaurants_district_idx   on restaurants (district_id);
create index restaurants_created_by_idx on restaurants (created_by);
-- 简单的搜索索引（生产应使用 pg_trgm 或 tsvector，P0 先 LIKE 兜底）
create index restaurants_search_idx     on restaurants (search_text);

-- ----------------------------------------------------------------
-- practice_records · 实践单
-- 一个用户对一家餐厅的一次主实践记录
-- ----------------------------------------------------------------
create table practice_records (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references profiles (id) on delete cascade,
  restaurant_id        uuid not null references restaurants (id) on delete cascade,
  tier                 tier not null,
  store_comment        text,
  is_public            boolean not null default true,
  is_valid_practice    boolean not null default false,
  valid_practice_at    timestamptz,
  created_from         text not null, -- amap / manual / existing（提交时 POI 的来源）
  source_poi_payload   jsonb,         -- 提交时的高德原始 POI 数据快照
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger practice_records_set_updated_at
  before update on practice_records
  for each row execute function public.set_updated_at();

-- 同一用户对同一家餐厅只能有一条有效主实践记录
create unique index practice_records_unique_active
  on practice_records (user_id, restaurant_id)
  where is_active = true;

create index practice_records_user_idx              on practice_records (user_id);
create index practice_records_restaurant_idx        on practice_records (restaurant_id);
create index practice_records_tier_idx              on practice_records (tier);
create index practice_records_public_idx            on practice_records (is_public);
create index practice_records_valid_practice_idx    on practice_records (is_valid_practice);

-- ----------------------------------------------------------------
-- dishes · 餐厅下的菜品实体
-- ----------------------------------------------------------------
create table dishes (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references restaurants (id) on delete cascade,
  name            text not null,
  cover_image_url text,
  -- 聚合字段，由 Edge Function 或定时任务维护
  avg_score       numeric(3, 1),
  review_count    int not null default 0,
  top_comment     text,
  youpin_count    int not null default 0,
  yebang_count    int not null default 0,
  created_by      uuid not null references profiles (id) on delete restrict,
  status          dish_status not null default 'active',
  merged_to_id    uuid references dishes (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger dishes_set_updated_at
  before update on dishes
  for each row execute function public.set_updated_at();

create index dishes_restaurant_idx on dishes (restaurant_id);
create index dishes_status_idx     on dishes (status);
create index dishes_name_idx       on dishes (name);

-- ----------------------------------------------------------------
-- dish_reviews · 菜品评价
-- 用户在实践单下对某道菜的评价
-- ----------------------------------------------------------------
create table dish_reviews (
  id                   uuid primary key default gen_random_uuid(),
  practice_record_id   uuid not null references practice_records (id) on delete cascade,
  dish_id              uuid not null references dishes (id) on delete cascade,
  score                int  check (score is null or (score >= 0 and score <= 10)),
  comment              text,
  image_url            text,
  is_public            boolean not null default true,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger dish_reviews_set_updated_at
  before update on dish_reviews
  for each row execute function public.set_updated_at();

-- 同一实践单下同一道菜只允许一条评价
create unique index dish_reviews_unique_active
  on dish_reviews (practice_record_id, dish_id)
  where is_active = true;

create index dish_reviews_practice_idx on dish_reviews (practice_record_id);
create index dish_reviews_dish_idx     on dish_reviews (dish_id);
create index dish_reviews_public_idx   on dish_reviews (is_public);
create index dish_reviews_score_idx    on dish_reviews (score);
