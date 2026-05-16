/** 中国大陆 11 位手机号 → Supabase/E.164 常用格式 +8613xxxxxxxx */
export function normalizeChinaMobileToE164(input: string): string | null {
  const trimmed = input.trim().replace(/\s+/g, '')
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+86${digits}`
  // 已是 8613… 长度 13
  if (digits.length === 13 && digits.startsWith('86')) {
    const rest = digits.slice(2)
    if (rest.length === 11 && rest.startsWith('1')) return `+86${rest}`
  }
  return null
}
