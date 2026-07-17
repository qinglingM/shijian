import { useMyBlockedUsers } from '@/features/blocks/useMyBlockedUsers'

export function BlockedUsersBootstrap() {
  useMyBlockedUsers()
  return null
}
