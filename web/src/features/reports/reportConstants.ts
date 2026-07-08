import type { ContentReportReason } from '@/lib/db'

export const REPORT_REASON_OPTIONS: Array<{ code: ContentReportReason; label: string }> = [
  { code: 'abuse', label: '人身攻击/辱骂' },
  { code: 'porn', label: '色情低俗' },
  { code: 'illegal', label: '违法违规' },
  { code: 'false_info', label: '虚假信息/恶意误导' },
  { code: 'spam', label: '广告导流/垃圾内容' },
  { code: 'infringement', label: '侵权/盗图' },
  { code: 'other', label: '其他' },
]
