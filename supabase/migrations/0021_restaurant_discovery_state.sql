-- ====================================================================
-- 0021 · Restaurant discovery state
-- 浏览 POI 详情页时先写入 pending restaurant；标记/食鉴后再转 active。
-- ====================================================================

alter table restaurants
  add column if not exists discovered_from text not null default 'practice'
    check (discovered_from in ('detail_view', 'mark', 'practice', 'manual'));

comment on column restaurants.discovered_from is
  '餐厅最初进入库的来源：detail_view=打开POI详情页，mark=标记想去，practice=提交食鉴，manual=手动录入。';

create or replace function public.ensure_pending_poi_restaurant(
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
) returns uuid
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_restaurant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_restaurant_id
  from restaurants
  where poi_source = p_poi_source::poi_source and poi_id = p_poi_id
  limit 1;

  if v_restaurant_id is not null then
    update restaurants
    set
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
    where id = v_restaurant_id;

    return v_restaurant_id;
  end if;

  insert into restaurants (
    poi_source,
    poi_id,
    poi_name,
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
    created_by,
    search_text
  ) values (
    p_poi_source::poi_source,
    p_poi_id,
    p_display_name,
    p_display_name,
    p_display_name,
    p_address_text,
    p_location_hint,
    p_latitude,
    p_longitude,
    p_city_name,
    p_district_name,
    p_category_name,
    nullif(p_cover_image_url, ''),
    'pending',
    'detail_view',
    v_user_id,
    array_to_string(array_remove(array[
      p_display_name,
      p_address_text,
      p_city_name,
      p_district_name,
      p_category_name
    ], null), ' ')
  )
  returning id into v_restaurant_id;

  return v_restaurant_id;
end;
$$;
