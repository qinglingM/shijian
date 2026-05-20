-- 同步百度/高德 POI Type 映射的分类到 categories 表，
-- 使 POI 入库的餐厅也能关联 category_id。

-- 安全起见，迁移脚本不可重复执行则跳过
do $$ begin
  if not exists (select 1 from categories where name = '中餐') then
    insert into categories (name, description, sort_order) values
      ('中餐',     '中餐厅/中式正餐',         11),
      ('异国料理', '外国餐厅/异国风味',       12),
      ('快餐',     '快餐厅/简餐',             21),
      ('休闲餐饮', '休闲餐饮场所/茶餐厅',     25),
      ('咖啡厅',   '咖啡厅/咖啡馆',           41),
      ('茶饮',     '茶艺馆/冷饮店/奶茶',      42),
      ('甜品烘焙', '糕饼店/甜品店/面包房',    43);
  end if;
end $$;
