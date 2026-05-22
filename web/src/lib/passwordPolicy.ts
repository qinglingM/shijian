/** 与产品说明书对齐的口令规则提示（中英混排句，勿改前缀以便 UI 多处复用） */
export const PASSWORD_RULE_HINT = '密码需为 8–20 位，包含字母和数字，不能包含中文'

const WEAK_COMMON = new Set([
  '12345678',
  'password123',
  'qwerty123',
  'abcd1234',
  '88888888',
])

export function validatePasswordForAccount(password: string): string | null {
  const p = password
  if (p.length < 8 || p.length > 20) return PASSWORD_RULE_HINT
  if (/[\u4e00-\u9fff]/.test(p)) return '密码不能包含中文字符'
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return PASSWORD_RULE_HINT
  if (WEAK_COMMON.has(p.toLowerCase())) return '请勿使用过于简单的密码'
  return null
}

/** 不推荐与手机号末 6 位相同（仅启发式校验，传纯数字手机号） */
export function passwordEndsWithPhoneTail(
  password: string,
  nationalNumberDigits: string,
): boolean {
  const tail = nationalNumberDigits.replace(/\D/g, '').slice(-6)
  return tail.length === 6 && password.endsWith(tail)
}
