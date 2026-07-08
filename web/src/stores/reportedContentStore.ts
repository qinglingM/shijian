import { create } from 'zustand'
import type { ContentReportRow, ContentReportTarget } from '@/lib/db'

type HiddenTargetsMap = Partial<Record<ContentReportTarget, Record<string, true>>>

interface ReportedContentState {
  hiddenTargets: HiddenTargetsMap
  hydrateFromReports: (reports: Pick<ContentReportRow, 'target_type' | 'target_id'>[]) => void
  hideTarget: (targetType: ContentReportTarget, targetId: string) => void
  reset: () => void
}

function buildHiddenTargets(reports: Pick<ContentReportRow, 'target_type' | 'target_id'>[]): HiddenTargetsMap {
  const next: HiddenTargetsMap = {}
  for (const report of reports) {
    const bucket = next[report.target_type] ?? {}
    bucket[report.target_id] = true
    next[report.target_type] = bucket
  }
  return next
}

export const useReportedContentStore = create<ReportedContentState>((set) => ({
  hiddenTargets: {},
  hydrateFromReports: (reports) => set({ hiddenTargets: buildHiddenTargets(reports) }),
  hideTarget: (targetType, targetId) =>
    set((state) => ({
      hiddenTargets: {
        ...state.hiddenTargets,
        [targetType]: {
          ...(state.hiddenTargets[targetType] ?? {}),
          [targetId]: true,
        },
      },
    })),
  reset: () => set({ hiddenTargets: {} }),
}))
