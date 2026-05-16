import type { CityRow } from '@/lib/db'

/** 热门展示顺序；与 cities.name 对齐时可先精确匹配再自动补「市」 */
export const HOT_CITY_ORDER = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '成都',
  '杭州',
  '重庆',
  '武汉',
  '南京',
  '西安',
] as const

export function pickHotCityRows(cities: CityRow[]): CityRow[] {
  const byName = new Map(cities.map((c) => [c.name, c]))
  const out: CityRow[] = []
  for (const token of HOT_CITY_ORDER) {
    let row = byName.get(token)
    if (!row && !token.endsWith('市')) row = byName.get(`${token}市`)
    if (row) out.push(row)
  }
  return out
}
