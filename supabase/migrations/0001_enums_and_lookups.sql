-- ====================================================================
-- 0001 · 枚举 + 查表（cities / districts / categories / titles）
-- ====================================================================
-- 该迁移建立基础的类型系统和查找表。
-- 不创建业务实体表（在 0002 中）。
-- ====================================================================

-- 扩展：pgcrypto 提供 gen_random_uuid()，Supabase 默认已启用，保险起见再 IF NOT EXISTS 一次
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- 通用：updated_at 自动维护
-- ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------
-- 枚举
-- ----------------------------------------------------------------
-- 餐厅六档
create type tier as enum (
  'boom',   -- 夯爆了
  'hang',   -- 夯
  'top',    -- 顶级
  'upper',  -- 人上人
  'npc',    -- NPC
  'bad'     -- 拉完了
);

-- POI 来源
create type poi_source as enum (
  'amap',
  'manual',
  'tencent',
  'baidu',
  'apple'
);

-- 餐厅状态
create type restaurant_status as enum (
  'active',
  'pending',
  'merged',
  'hidden'
);

-- 菜品状态
create type dish_status as enum (
  'active',
  'merged',
  'hidden'
);

-- 投票类型
create type vote_type as enum (
  'youpin',  -- 有品
  'yebang'   -- 野榜
);

-- 投票目标
create type vote_target as enum (
  'store_review',  -- 店铺实践锐评
  'dish_review'    -- 菜品锐评
);

-- 别名来源
create type alias_source as enum (
  'user',
  'merge',
  'system'
);

-- 图片附着目标类型
create type image_target_type as enum (
  'restaurant',
  'dish',
  'dish_review',
  'profile'
);

-- 图片资源状态
create type image_status as enum (
  'active',
  'hidden',
  'deleted'
);

-- 称号稀有度
create type title_rarity as enum (
  'common',     -- 普通
  'rare',       -- 稀有
  'epic',       -- 史诗
  'legendary'   -- 传说
);

-- ----------------------------------------------------------------
-- 城市
-- ----------------------------------------------------------------
create table cities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  province_name text,
  sort_order    int  default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index cities_active_idx on cities (is_active, sort_order);

-- ----------------------------------------------------------------
-- 行政区
-- ----------------------------------------------------------------
create table districts (
  id          uuid primary key default gen_random_uuid(),
  city_id     uuid not null references cities (id) on delete cascade,
  name        text not null,
  sort_order  int  default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index districts_city_idx on districts (city_id, sort_order);
create unique index districts_unique_in_city on districts (city_id, name);

-- ----------------------------------------------------------------
-- 餐厅分类
-- ----------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort_order  int  default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index categories_active_idx on categories (is_active, sort_order);

-- ----------------------------------------------------------------
-- 称号定义
-- ----------------------------------------------------------------
create table titles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  rarity      title_rarity not null default 'common',
  description text,
  icon_url    text,
  unlock_rule jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index titles_active_idx on titles (is_active);
