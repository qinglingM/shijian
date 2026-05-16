import type { CityRow } from '@/lib/db'

const MUNICIPAL_PROVINCE = new Set(['北京市', '天津市', '上海市', '重庆市'])

/**
 * 同一省级下、「杭州」与「杭州市」等价（末尾「市」可省）时使用此键聚合。
 */
export function prefectureDedupeCompositeKey(
  row: Pick<CityRow, 'name' | 'province_name'>,
): string {
  const pn = (row.province_name ?? '').trim() || '——'
  let core = row.name.trim()
  if (!MUNICIPAL_PROVINCE.has(pn)) core = core.replace(/市$/u, '')
  return `${pn}\0${core}`
}

/** 优选 0008 标准名所在行（带「市」、有拼音等） */
function rowCanonicalScore(r: CityRow): number {
  let s = 0
  if (r.name.trim().endsWith('市')) s += 4
  if ((r.name_pinyin ?? '').trim()) s += 2
  return s
}

/**
 * 去掉与标准地级名重复的简称行（P0 seed 与 0008 并存时出现）。
 */
export function dedupeTwinPrefectureCityRows(cities: CityRow[]): CityRow[] {
  const m = new Map<string, CityRow>()
  for (const c of cities) {
    const k = prefectureDedupeCompositeKey(c)
    const prev = m.get(k)
    if (!prev || rowCanonicalScore(c) > rowCanonicalScore(prev)) m.set(k, c)
  }
  return [...m.values()]
}
