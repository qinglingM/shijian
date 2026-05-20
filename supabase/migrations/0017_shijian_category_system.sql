-- ====================================================================
-- 0017 · 食鉴双层分类体系
-- 新增 subcategories 表，为 restaurants 增加小类与展示字段
-- ====================================================================

-- ----------------------------------------------------------------
-- 1. 更新 categories 种子数据：插入食鉴 9 大類（如已存在则跳过）
-- ----------------------------------------------------------------
do $$ begin
  if not exists (select 1 from categories where name = '中餐') then
    insert into categories (name, description, sort_order) values
      ('中餐',       '中式正餐/地方菜系',           10),
      ('火锅烧烤',   '火锅/烧烤/烤肉/烤鱼',         20),
      ('小吃快餐',   '快餐/简餐/粉面/汉堡炸鸡',     30),
      ('日韩料理',   '日本料理/韩国料理',           40),
      ('西餐',       '西式正餐/法意美式',           50),
      ('东南亚菜',   '泰越菜/印度菜/亚洲菜',        60),
      ('咖啡茶饮',   '咖啡/茶饮/奶茶/冷饮',         70),
      ('甜品面包',   '甜品/烘焙/蛋糕/冰淇淋',        80),
      ('其他餐饮',   '无法归类的餐饮场所',           90);
  end if;
end $$;

-- ----------------------------------------------------------------
-- 2. 创建 subcategories 表（食鉴小类）
-- ----------------------------------------------------------------
create table if not exists subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  name        text not null,
  sort_order  int  default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (category_id, name)
);

create index if not exists subcategories_category_idx on subcategories (category_id, sort_order);

comment on table subcategories is '食鉴小类，每个小类属于一个大类（categories）';

-- ----------------------------------------------------------------
-- 3. 插入小类数据
-- ----------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  -- 中餐
  v_id := (select id from categories where name = '中餐' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '综合中餐', 10), (v_id, '综合酒楼', 20), (v_id, '四川菜', 30),
      (v_id, '广东菜', 40), (v_id, '山东菜', 50), (v_id, '江苏菜', 60),
      (v_id, '浙江菜', 70), (v_id, '上海菜', 80), (v_id, '湖南菜', 90),
      (v_id, '安徽菜', 100), (v_id, '福建菜', 110), (v_id, '北京菜', 120),
      (v_id, '湖北菜', 130), (v_id, '东北菜', 140), (v_id, '云贵菜', 150),
      (v_id, '西北菜', 160), (v_id, '老字号', 170), (v_id, '地方风味', 180),
      (v_id, '海鲜', 190), (v_id, '素食', 200), (v_id, '清真菜馆', 210),
      (v_id, '台湾菜', 220), (v_id, '潮州菜', 230)
    on conflict (category_id, name) do nothing;
  end if;

  -- 火锅烧烤
  v_id := (select id from categories where name = '火锅烧烤' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '火锅', 10), (v_id, '烧烤', 20), (v_id, '烤肉', 30),
      (v_id, '烤鱼', 40), (v_id, '串串', 50), (v_id, '涮肉', 60)
    on conflict (category_id, name) do nothing;
  end if;

  -- 小吃快餐
  v_id := (select id from categories where name = '小吃快餐' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '快餐', 10), (v_id, '汉堡炸鸡', 20), (v_id, '中式快餐', 30),
      (v_id, '日式快餐', 40), (v_id, '港式快餐', 50), (v_id, '茶餐厅', 60),
      (v_id, '面馆', 70), (v_id, '粉面', 80), (v_id, '米粉米线', 90),
      (v_id, '麻辣烫', 100), (v_id, '包子饺子', 110), (v_id, '盖饭简餐', 120)
    on conflict (category_id, name) do nothing;
  end if;

  -- 日韩料理
  v_id := (select id from categories where name = '日韩料理' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '日本料理', 10), (v_id, '韩国料理', 20), (v_id, '寿司', 30),
      (v_id, '日式拉面', 40), (v_id, '韩式烤肉', 50), (v_id, '居酒屋', 60)
    on conflict (category_id, name) do nothing;
  end if;

  -- 西餐
  v_id := (select id from categories where name = '西餐' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '西餐', 10), (v_id, '法国菜', 20), (v_id, '意大利菜', 30),
      (v_id, '地中海菜', 40), (v_id, '美式餐厅', 50), (v_id, '英国菜', 60),
      (v_id, '牛排', 70), (v_id, '俄国菜', 80), (v_id, '葡国菜', 90),
      (v_id, '德国菜', 100), (v_id, '巴西菜', 110), (v_id, '墨西哥菜', 120),
      (v_id, '披萨', 130)
    on conflict (category_id, name) do nothing;
  end if;

  -- 东南亚菜
  v_id := (select id from categories where name = '东南亚菜' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '泰越菜', 10), (v_id, '印度菜', 20), (v_id, '亚洲菜', 30),
      (v_id, '东南亚菜', 40)
    on conflict (category_id, name) do nothing;
  end if;

  -- 咖啡茶饮
  v_id := (select id from categories where name = '咖啡茶饮' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '咖啡', 10), (v_id, '茶饮', 20), (v_id, '茶馆', 30),
      (v_id, '冷饮', 40), (v_id, '果汁', 50), (v_id, '奶茶', 60)
    on conflict (category_id, name) do nothing;
  end if;

  -- 甜品面包
  v_id := (select id from categories where name = '甜品面包' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '甜品', 10), (v_id, '面包烘焙', 20), (v_id, '蛋糕', 30),
      (v_id, '冰淇淋', 40)
    on conflict (category_id, name) do nothing;
  end if;

  -- 其他餐饮
  v_id := (select id from categories where name = '其他餐饮' limit 1);
  if v_id is not null then
    insert into subcategories (category_id, name, sort_order) values
      (v_id, '其他餐饮', 10), (v_id, '休闲餐饮', 20),
      (v_id, '餐饮相关场所', 30), (v_id, '未知餐饮', 40)
    on conflict (category_id, name) do nothing;
  end if;
end $$;

-- ----------------------------------------------------------------
-- 4. restaurants 表增加新分类字段
-- ----------------------------------------------------------------
alter table restaurants
  add column if not exists subcategory_id       uuid references subcategories (id) on delete set null,
  add column if not exists display_category_label text,
  add column if not exists amap_type_code       text,
  add column if not exists amap_mid_category    text,
  add column if not exists amap_small_category  text;

comment on column restaurants.subcategory_id       is '食鉴小类 ID（新双层分类体系）';
comment on column restaurants.display_category_label is '餐厅卡片展示的分类标签（通常 = 小类名）';
comment on column restaurants.amap_type_code       is '高德 POI typecode，如 050111';
comment on column restaurants.amap_mid_category    is '高德中类文本，如 中餐厅';
comment on column restaurants.amap_small_category  is '高德小类文本，如 北京菜';
