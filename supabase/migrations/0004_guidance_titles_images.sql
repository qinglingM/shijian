-- ====================================================================
-- 0004 · 好评诱导反馈 / 用户称号 / 别名 / 图片资源
-- ====================================================================

-- ----------------------------------------------------------------
-- good_review_guidance_feedbacks · 好评诱导反馈
-- 只有完成有效实践的用户才能反馈
-- ----------------------------------------------------------------
create table good_review_guidance_feedbacks (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles (id) on delete cascade,
  restaurant_id       uuid not null references restaurants (id) on delete cascade,
  practice_record_id  uuid not null references practice_records (id) on delete cascade,
  has_guidance        boolean not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- 同一用户对同一店只能反馈一次（因为同一用户对同一店只有一条主实践）
  unique (user_id, restaurant_id)
);

create trigger guidance_feedbacks_set_updated_at
  before update on good_review_guidance_feedbacks
  for each row execute function public.set_updated_at();

create index guidance_feedbacks_restaurant_idx on good_review_guidance_feedbacks (restaurant_id);

-- ----------------------------------------------------------------
-- user_titles · 用户获得的称号
-- ----------------------------------------------------------------
create table user_titles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  title_id     uuid not null references titles (id) on delete restrict,
  is_equipped  boolean not null default false,
  obtained_at  timestamptz not null default now(),
  unique (user_id, title_id)
);

create index user_titles_user_idx on user_titles (user_id);

-- 现在可以补 profiles.current_title_id 的外键约束
alter table profiles
  add constraint profiles_current_title_fk
  foreign key (current_title_id) references user_titles (id) on delete set null;

-- ----------------------------------------------------------------
-- restaurant_aliases · 餐厅别名（搜索召回 + 合并保留旧名）
-- ----------------------------------------------------------------
create table restaurant_aliases (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  alias_name    text not null,
  source_type   alias_source not null,
  created_by    uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index restaurant_aliases_restaurant_idx on restaurant_aliases (restaurant_id);
create index restaurant_aliases_name_idx       on restaurant_aliases (alias_name);

-- ----------------------------------------------------------------
-- dish_aliases · 菜品别名
-- ----------------------------------------------------------------
create table dish_aliases (
  id          uuid primary key default gen_random_uuid(),
  dish_id     uuid not null references dishes (id) on delete cascade,
  alias_name  text not null,
  source_type alias_source not null,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index dish_aliases_dish_idx on dish_aliases (dish_id);
create index dish_aliases_name_idx on dish_aliases (alias_name);

-- ----------------------------------------------------------------
-- image_assets · 图片资源
-- ----------------------------------------------------------------
create table image_assets (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles (id) on delete cascade,
  url           text not null,
  bucket        text not null,
  path          text not null,
  mime_type     text,
  size_bytes    int,
  target_type   image_target_type,
  target_id     uuid,
  status        image_status not null default 'active',
  created_at    timestamptz not null default now()
);

create index image_assets_owner_idx  on image_assets (owner_id);
create index image_assets_target_idx on image_assets (target_type, target_id);
