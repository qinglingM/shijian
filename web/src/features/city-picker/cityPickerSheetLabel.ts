/** 直辖市在 cities 中为单名（如北京）；选择面板内需与省级全称一致时才用省名展示 */
const MUNICIPAL_PROVINCE_NAMES = new Set(['北京市', '天津市', '上海市', '重庆市'])

/** 弹窗列表、胶囊文案：地级市用 cities.name；直辖市四条用省级全称「××市」。 */
export function cityPickerSheetLabel(c: { name: string; province_name?: string | null }): string {
  const pn = (c.province_name ?? '').trim()
  if (MUNICIPAL_PROVINCE_NAMES.has(pn)) return pn
  return c.name
}

/**
 * 胶囊单行展示：若以「市」结尾则去掉「市」（含直辖市「北京市」→「北京」）；自治州盟县等保持不变。
 */
export function cityPickerChipDisplayName(c: { name: string; province_name?: string | null }): string {
  const s = cityPickerSheetLabel(c).trim()
  if (s.endsWith('市')) return s.slice(0, -1)
  return s
}
