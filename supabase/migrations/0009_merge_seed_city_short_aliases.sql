-- ====================================================================
-- P0 seed 曾插入「杭州 / 成都 / 广州 / 深圳」，0008 再插入「杭州市 / …」，
-- （name, province）唯一索引不冲突时出现两行等价地级区划。
-- 本迁移：将全部引用迁到标准名行再删除简称行。
-- ====================================================================

create or replace function temp_merge_city_pair(sn text, ln text, prov text)
returns void
language plpgsql
as $$
declare
  sid uuid;
  lid uuid;
begin
  select id into sid
  from cities
  where name = sn and coalesce(province_name, '') = prov
  limit 1;
  select id into lid
  from cities
  where name = ln and coalesce(province_name, '') = prov
  limit 1;
  if sid is null or lid is null or sid = lid then
    return;
  end if;

  update districts set city_id = lid where city_id = sid;
  update profiles set city_id = lid where city_id = sid;
  update restaurants set city_id = lid where city_id = sid;

  delete from cities where id = sid;
end;
$$;

select temp_merge_city_pair('杭州', '杭州市', '浙江省');
select temp_merge_city_pair('成都', '成都市', '四川省');
select temp_merge_city_pair('广州', '广州市', '广东省');
select temp_merge_city_pair('深圳', '深圳市', '广东省');

drop function temp_merge_city_pair(text, text, text);
