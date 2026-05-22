-- backfill display_category_label for existing restaurants
-- uses the same mid-level fallback logic as mapAmapToShijian in submit-practice/index.ts
update restaurants
set display_category_label = case
  when amap_mid_category = '中餐厅'         then '综合中餐'
  when amap_mid_category = '外国餐厅'       then '西餐'
  when amap_mid_category = '快餐厅'         then '快餐'
  when amap_mid_category = '休闲餐饮场所'   then '休闲餐饮'
  when amap_mid_category = '咖啡厅'         then '咖啡'
  when amap_mid_category = '茶艺馆'         then '茶馆'
  when amap_mid_category = '冷饮店'         then '冷饮'
  when amap_mid_category = '糕饼店'         then '面包烘焙'
  when amap_mid_category = '甜品店'         then '甜品'
  when amap_mid_category = '餐饮相关场所'   then '餐饮相关场所'
  else '其他餐饮'
end
where display_category_label is null
  and status = 'active';
