import type { ContentReportReason, ContentReportTarget } from '@/lib/db'

export const TEXT_REVIEW_REASONS: Array<{ code: ContentReportReason; label: string }> = [
  { code: 'abuse', label: '人身攻击/辱骂' },
  { code: 'porn', label: '色情低俗' },
  { code: 'illegal', label: '违法违规' },
  { code: 'false_info', label: '虚假信息/恶意误导' },
  { code: 'spam', label: '广告导流/垃圾内容' },
  { code: 'other', label: '其他' },
]

export const IMAGE_REVIEW_REASONS: Array<{ code: ContentReportReason; label: string }> = [
  { code: 'porn', label: '色情低俗' },
  { code: 'illegal', label: '违法违规' },
  { code: 'infringement', label: '侵权/盗图' },
  { code: 'spam', label: '广告导流/垃圾内容' },
  { code: 'other', label: '其他' },
]

export function getReportReasons(targetType: ContentReportTarget) {
  if (targetType === 'dish_review_image') return IMAGE_REVIEW_REASONS
  return TEXT_REVIEW_REASONS
}
