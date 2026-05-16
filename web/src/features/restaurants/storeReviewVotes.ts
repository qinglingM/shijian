import type { VoteType } from '@/lib/db'

export function intentAfterVoteTap(
  mine: VoteType | null,
  which: VoteType,
): VoteType | null {
  if (mine === which) return null
  return which
}

export function applyStoreReviewVoteClick(
  youpin: number,
  yebang: number,
  mine: VoteType | null,
  which: VoteType,
): { youpin: number; yebang: number; mine: VoteType | null } {
  if (mine === which) {
    if (which === 'youpin') return { youpin: Math.max(0, youpin - 1), yebang, mine: null }
    return { youpin, yebang: Math.max(0, yebang - 1), mine: null }
  }
  if (mine === null) {
    if (which === 'youpin') return { youpin: youpin + 1, yebang, mine: 'youpin' }
    return { youpin, yebang: yebang + 1, mine: 'yebang' }
  }
  if (mine === 'youpin' && which === 'yebang') {
    return { youpin: Math.max(0, youpin - 1), yebang: yebang + 1, mine: 'yebang' }
  }
  return { youpin: youpin + 1, yebang: Math.max(0, yebang - 1), mine: 'youpin' }
}
