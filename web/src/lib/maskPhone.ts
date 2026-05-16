/** 展示用脱敏，不作安全边界 */
export function maskPhoneDisplay(phone: string): string {
  const p = phone.trim()
  if (p.length <= 4) return '****'
  if (p.length <= 7) return `${p.slice(0, 2)}****`
  return `${p.slice(0, 3)}****${p.slice(-2)}`
}
