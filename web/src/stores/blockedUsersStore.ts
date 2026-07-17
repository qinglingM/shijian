import { create } from 'zustand'
import type { UserBlockRow } from '@/lib/db'

export type BlockedUsersMap = Record<string, true>

interface BlockedUsersState {
  blockedUserIds: BlockedUsersMap
  hydrateFromBlocks: (blocks: Pick<UserBlockRow, 'blocked_user_id'>[]) => void
  blockUser: (userId: string) => void
  unblockUser: (userId: string) => void
  reset: () => void
}

function buildBlockedUsers(blocks: Pick<UserBlockRow, 'blocked_user_id'>[]) {
  const next: BlockedUsersMap = {}
  for (const block of blocks) next[block.blocked_user_id] = true
  return next
}

export const useBlockedUsersStore = create<BlockedUsersState>((set) => ({
  blockedUserIds: {},
  hydrateFromBlocks: (blocks) => set({ blockedUserIds: buildBlockedUsers(blocks) }),
  blockUser: (userId) =>
    set((state) => ({
      blockedUserIds: {
        ...state.blockedUserIds,
        [userId]: true,
      },
    })),
  unblockUser: (userId) =>
    set((state) => {
      const next = { ...state.blockedUserIds }
      delete next[userId]
      return { blockedUserIds: next }
    }),
  reset: () => set({ blockedUserIds: {} }),
}))
