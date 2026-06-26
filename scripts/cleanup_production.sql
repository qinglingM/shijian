-- ====================================================================
-- 食鉴 · 生产环境全面清理脚本
-- 用途：上线前清除所有测试数据，保留 Schema 和参考数据（城市/分类/称号）
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴执行
-- ⚠️ 请先手动备份数据库！
-- ====================================================================

-- ============================================================
-- 第 1 步：暂停触发器（避免删除 auth.users 时触发 handle_new_user）
-- ============================================================
alter table profiles disable trigger trigger_welcome_notification;

-- ============================================================
-- 第 2 步：按外键依赖顺序清空业务数据（从最深依赖到最浅）
-- ============================================================
delete from dish_reviews;
delete from dish_aliases;
delete from review_votes;
delete from good_review_guidance_feedbacks;
delete from posts;
delete from bole_records;
delete from dishes;
delete from practice_records;
delete from restaurant_aliases;
delete from marks;
delete from restaurant_feedbacks;
delete from user_titles;
delete from notifications;
delete from image_assets;
delete from user_follows;
delete from restaurants;

-- ============================================================
-- 第 3 步：关闭 profiles 的 RLS（删除 auth.users 时级联删除 profiles）
-- ============================================================
alter table profiles disable row level security;

-- ============================================================
-- 第 4 步：删除所有已知测试 auth 用户
-- profiles 通过 id 外键 on delete cascade 会自动被删除
-- ============================================================
delete from auth.users
where email in (
  '770638046@qq.com',              -- fixture 测试用户
  'dev-shijian-1@local.dev',       -- 预留开发账号
  'dev-shijian-2@local.dev',
  'dev-shijian-3@local.dev',
  'dev-shijian-4@local.dev',
  'dev-shijian-5@local.dev'
)
or regexp_replace(coalesce(phone::text, ''), '[^0-9]', '', 'g') = '8613718550959';

-- ============================================================
-- 第 5 步：清理所有白名单/豁免表（上线后不应存在任何豁免账号）
-- ============================================================
delete from registration_phone_allowlist;
delete from phone_binding_exempt_mobiles;

-- ============================================================
-- 第 6 步：重新启用 RLS 和触发器
-- ============================================================
alter table profiles enable row level security;
alter table profiles enable trigger trigger_welcome_notification;

-- ============================================================
-- 第 7 步：确认参考数据完整（以下语句仅作插入，已有则跳过）
-- ============================================================

-- 城市（6 个一线/新一线）
insert into cities (name, province_name, sort_order)
select name, province_name, sort_order
from (values
  ('北京', '北京市',       10),
  ('上海', '上海市',       20),
  ('广州市', '广东省',     30),
  ('深圳市', '广东省',     40),
  ('杭州市', '浙江省',     50),
  ('成都市', '四川省',     60)
) as t (name, province_name, sort_order)
where not exists (select 1 from cities where cities.name = t.name);

-- 行政区（每个城市 5-7 个）
insert into districts (city_id, name, sort_order)
select c.id, d.name, d.sort_order
from (values
  ('北京', '东城区', 10), ('北京', '西城区', 20), ('北京', '朝阳区', 30),
  ('北京', '海淀区', 40), ('北京', '丰台区', 50), ('北京', '通州区', 60),
  ('上海', '黄浦区', 10), ('上海', '徐汇区', 20), ('上海', '长宁区', 30),
  ('上海', '静安区', 40), ('上海', '浦东新区', 50),
  ('广州市', '越秀区', 10), ('广州市', '海珠区', 20), ('广州市', '荔湾区', 30),
  ('广州市', '天河区', 40), ('广州市', '番禺区', 50),
  ('深圳市', '福田区', 10), ('深圳市', '罗湖区', 20), ('深圳市', '南山区', 30),
  ('深圳市', '宝安区', 40), ('深圳市', '龙岗区', 50),
  ('杭州市', '上城区', 10), ('杭州市', '拱墅区', 20), ('杭州市', '西湖区', 30),
  ('杭州市', '滨江区', 40), ('杭州市', '余杭区', 50),
  ('成都市', '锦江区', 10), ('成都市', '青羊区', 20), ('成都市', '武侯区', 30),
  ('成都市', '成华区', 40), ('成都市', '高新区', 50)
) as d (city_name, name, sort_order)
join cities c on c.name = d.city_name
where not exists (select 1 from districts where districts.city_id = c.id and districts.name = d.name);

-- 分类（9 大类 + 小类，migration 0017 已处理，确保存在）
insert into categories (name, description, sort_order)
select name, description, sort_order
from (values
  ('中餐',       '中式正餐/地方菜系',           10),
  ('火锅烧烤',   '火锅/烧烤/烤肉/烤鱼',         20),
  ('小吃快餐',   '快餐/简餐/粉面/汉堡炸鸡',     30),
  ('日韩料理',   '日本料理/韩国料理',           40),
  ('西餐',       '西式正餐/法意美式',           50),
  ('东南亚菜',   '泰越菜/印度菜/亚洲菜',        60),
  ('咖啡茶饮',   '咖啡/茶饮/奶茶/冷饮',         70),
  ('甜品面包',   '甜品/烘焙/蛋糕/冰淇淋',        80),
  ('其他餐饮',   '无法归类的餐饮场所',           90)
) as t (name, description, sort_order)
where not exists (select 1 from categories where categories.name = t.name);

-- 称号（4 个）
insert into titles (name, rarity, description, unlock_rule)
select name, rarity, description, unlock_rule
from (values
  ('食鉴新生', 'common', '完成第一次有效实践', jsonb_build_object('type','valid_practice_count','threshold',1)),
  ('八方食客', 'rare', '累计食鉴 8 家店', jsonb_build_object('type','total_practice_count','threshold',8)),
  ('一城伯乐', 'epic', '在一个城市内获得 5 次伯乐', jsonb_build_object('type','bole_count_in_city','threshold',5)),
  ('夯爆收藏家', 'legendary', '夯爆了 档位累计收藏 20 家', jsonb_build_object('type','tier_count','tier','boom','threshold',20))
) as t (name, rarity, description, unlock_rule)
where not exists (select 1 from titles where titles.name = t.name);

-- ====================================================================
-- 第 8 步：验证结果
-- ====================================================================
select '===== 参考数据行数 =====' as info;
select 'cities' as table_name, count(*) from cities
union all select 'districts', count(*) from districts
union all select 'categories', count(*) from categories
union all select 'titles', count(*) from titles;

select '===== 业务数据行数（以下应为全 0）=====' as info;
select 'restaurants' as table_name, count(*) from restaurants
union all select 'practice_records', count(*) from practice_records
union all select 'dishes', count(*) from dishes
union all select 'dish_reviews', count(*) from dish_reviews
union all select 'marks', count(*) from marks
union all select 'bole_records', count(*) from bole_records
union all select 'review_votes', count(*) from review_votes
union all select 'good_review_guidance_feedbacks', count(*) from good_review_guidance_feedbacks
union all select 'posts', count(*) from posts
union all select 'user_follows', count(*) from user_follows
union all select 'user_titles', count(*) from user_titles
union all select 'notifications', count(*) from notifications
union all select 'image_assets', count(*) from image_assets
union all select 'restaurant_feedbacks', count(*) from restaurant_feedbacks
union all select 'restaurant_aliases', count(*) from restaurant_aliases
union all select 'dish_aliases', count(*) from dish_aliases;

select '===== profiles（应只剩 auth 系统的 service 用户）=====' as info;
select id, user_code, nickname, created_at from profiles;
