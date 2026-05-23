import { CATEGORIES, WORDLIST } from './wordlist'

export type CategoryName = (typeof CATEGORIES)[number]

export interface ModerationHit {
  term: string
  severity: 1 | 2 | 3
  category: CategoryName
}

export interface ModerationResult {
  /** 最高风险等级命中，1=S1/2=S2/3=S3，null 表示无命中 */
  maxSeverity: 1 | 2 | 3 | null
  /** 所有命中词（去重后前 10 条，避免暴露过多） */
  hits: ModerationHit[]
  /** 给用户展示的错误/提示信息，S1 为软提示，S2/S3 为阻止 */
  message: string | null
  /** true = 阻止提交，false = 允许提交（S1 仅提示） */
  blocked: boolean
}

// ── 文本归一化 ────────────────────────────────────────────────────────────────

const FULLWIDTH_OFFSET = 0xfee0
const FULLWIDTH_SPACE = 0x3000

function normalizeText(text: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0xff01 && code <= 0xff5e) {
      // 全角 ASCII → 半角
      result += String.fromCharCode(code - FULLWIDTH_OFFSET)
    } else if (code === FULLWIDTH_SPACE) {
      result += ' '
    } else {
      result += text[i]
    }
  }
  // 统一小写、去除空白和常见干扰符号
  return result
    .toLowerCase()
    .replace(/[\s​­’'"·•\-_~@#%^&*+=|\\/<>[\]{}]/g, '')
}

// ── 核心检测 ──────────────────────────────────────────────────────────────────

export function checkTexts(texts: string[]): ModerationResult {
  const normalized = texts.map(normalizeText)

  const seen = new Set<string>()
  const hits: ModerationHit[] = []

  for (const [term, sev, catIdx] of WORDLIST) {
    if (seen.has(term)) continue
    const normTerm = normalizeText(term)
    if (!normTerm) continue

    for (const normText of normalized) {
      if (normText.includes(normTerm)) {
        seen.add(term)
        hits.push({
          term,
          severity: sev as 1 | 2 | 3,
          category: CATEGORIES[catIdx],
        })
        break
      }
    }

    // 找到足够多命中后可提前截断（保留 10 条即可给 UI 用）
    if (hits.length >= 20) break
  }

  if (hits.length === 0) {
    return { maxSeverity: null, hits: [], message: null, blocked: false }
  }

  const maxSeverity = Math.max(...hits.map((h) => h.severity)) as 1 | 2 | 3
  const topHits = hits.slice(0, 10)
  const topCategory = topHits.reduce(
    (prev, cur) => (cur.severity >= prev.severity ? cur : prev),
    topHits[0],
  ).category

  const message = buildMessage(topCategory, maxSeverity)
  const blocked = maxSeverity >= 2

  return { maxSeverity, hits: topHits, message, blocked }
}

// ── 用户提示文案 ──────────────────────────────────────────────────────────────

function buildMessage(category: CategoryName, severity: 1 | 2 | 3): string {
  if (severity === 1) {
    switch (category) {
      case '广告法/极限词/绝对化表达':
        return '你的评价包含极限表达（如"全国第一""最好吃"），建议调整措辞后再发布。'
      case '医疗健康/食品功效误导':
        return '你的评价包含功效宣称词，建议调整措辞后再发布。'
      case '广告引流/联系方式':
        return '你的评价包含疑似联系方式或导流信息，建议删除后再发布。'
      default:
        return '你的评价包含敏感词，建议修改后再发布。'
    }
  }

  switch (category) {
    case '辱骂/人身攻击/网络暴力':
      return '你的评价包含人身攻击词，请改为描述具体用餐体验后再发布。'
    case '餐厅评价高风险指控':
      return '你的评价涉及严重食品安全指控（如"地沟油""有毒""诈骗"），发布前请修改或提供依据。'
    case '广告引流/联系方式':
      return '你的评价包含联系方式或导流信息，请删除后再发布。'
    case '隐私/人肉/个人信息':
      return '你的评价包含他人个人信息，请删除或脱敏后再发布。'
    case '诈骗/黑灰产/引流':
      return '你的评价包含疑似引流或欺诈信息，请删除后再发布。'
    case '色情低俗':
      return '你的评价包含不适当内容，请修改后再发布。'
    case '赌博博彩':
    case '毒品/违禁药物':
    case '暴力恐怖/武器':
    case '政治安全/违法有害':
      return '你的评价包含违禁内容，无法发布，请修改后再试。'
    case '歧视/仇恨/攻击群体':
      return '你的评价包含歧视性内容，请修改后再发布。'
    case '谣言/恐慌传播':
      return '你的评价包含可能引发恐慌的内容，请确认并修改后再发布。'
    case '广告法/极限词/绝对化表达':
      return '你的评价包含违禁极限表达，请修改后再发布。'
    case '医疗健康/食品功效误导':
      return '你的评价包含不当功效宣称，请修改后再发布。'
    default:
      return '你的评价包含违禁词，请修改后再发布。'
  }
}
