/**
 * 左上角城市入口展示的短文案（persist 仍为 cities.name 全称）。
 *
 * - 带「市」：去掉末尾「市」得主体；主体 ≤4 字用主体全文，主体 >4 字取前四字。
 * - 不带「市」等：全长 ≤4 用全长，否则前四字。
 */
export function cityNavbarAbbrev(fullOfficialName: string): string {
  const s = fullOfficialName.trim()
  if (!s) return ''

  if (s.endsWith('市')) {
    const stem = s.slice(0, -1)
    if (stem.length <= 4) return stem
    return stem.slice(0, 4)
  }

  if (s.length <= 4) return s
  return s.slice(0, 4)
}
