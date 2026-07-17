import type { BlockedUsersMap } from '@/stores/blockedUsersStore'

export function isUserBlocked(blockedUserIds: BlockedUsersMap, userId: string | null | undefined) {
  return Boolean(userId && blockedUserIds[userId])
}

export function filterVisibleItemsByBlockedUser<T extends { user_id?: string | null; reviewer_user_id?: string | null; top_reviewer_user_id?: string | null }>(
  items: T[],
  blockedUserIds: BlockedUsersMap,
) {
  return items.filter((item) => !isUserBlocked(
    blockedUserIds,
    item.user_id ?? item.reviewer_user_id ?? item.top_reviewer_user_id,
  ))
}
