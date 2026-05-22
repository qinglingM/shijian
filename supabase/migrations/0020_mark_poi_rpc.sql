-- ====================================================================
-- 0020 · RPC: Mark POI Restaurant
-- 允许用户标记尚未收录的 POI 时自动将其收录到 restaurants 表，
-- 并为其添加 mark 记录。
-- ====================================================================

CREATE OR REPLACE FUNCTION public.mark_poi_restaurant(
  p_poi_source text,
  p_poi_id text,
  p_display_name text,
  p_address_text text,
  p_location_hint text,
  p_latitude double precision,
  p_longitude double precision,
  p_city_name text,
  p_district_name text,
  p_category_name text,
  p_cover_image_url text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_restaurant_id uuid;
BEGIN
  -- 1. 检查是否未登录
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. 检查餐厅是否已经存在（pending / active 都复用）
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE poi_source = p_poi_source::poi_source AND poi_id = p_poi_id
  LIMIT 1;

  -- 3. 如果不存在，插入新的 active 餐厅记录；如果存在 pending，则激活
  IF v_restaurant_id IS NULL THEN
    INSERT INTO restaurants (
      poi_source,
      poi_id,
      brand_name,
      display_name,
      address_text,
      location_hint,
      latitude,
      longitude,
      city_name,
      district_name,
      display_category_label,
      cover_image_url,
      status,
      discovered_from,
      created_by
    ) VALUES (
      p_poi_source::poi_source,
      p_poi_id,
      p_display_name,
      p_display_name,
      p_address_text,
      p_location_hint,
      p_latitude,
      p_longitude,
      p_city_name,
      p_district_name,
      p_category_name,
      p_cover_image_url,
      'active',
      'mark',
      v_user_id
    )
    RETURNING id INTO v_restaurant_id;
  ELSE
    UPDATE restaurants
    SET
      status = 'active',
      discovered_from = case
        when discovered_from = 'detail_view' then 'mark'
        else discovered_from
      end,
      display_name = coalesce(nullif(display_name, ''), p_display_name),
      brand_name = coalesce(nullif(brand_name, ''), p_display_name),
      address_text = coalesce(address_text, p_address_text),
      location_hint = coalesce(location_hint, p_location_hint),
      latitude = coalesce(latitude, p_latitude::numeric),
      longitude = coalesce(longitude, p_longitude::numeric),
      city_name = coalesce(city_name, p_city_name),
      district_name = coalesce(district_name, p_district_name),
      display_category_label = coalesce(display_category_label, p_category_name),
      cover_image_url = coalesce(cover_image_url, nullif(p_cover_image_url, '')),
      updated_at = now()
    WHERE id = v_restaurant_id;
  END IF;

  -- 4. 插入想去标记（如果已存在则忽略）
  INSERT INTO marks (user_id, restaurant_id)
  VALUES (v_user_id, v_restaurant_id)
  ON CONFLICT (user_id, restaurant_id) DO NOTHING;

  -- 5. 返回餐厅的 UUID
  RETURN v_restaurant_id;
END;
$$;
