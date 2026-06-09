import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Mail, MailOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { getSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { isRegisteredUser } from '@/features/auth/useRequireLogin'

class SafeMarkdown extends Component<{ content: string }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return <div className="whitespace-pre-wrap">{this.props.content}</div>
    }
    return <ReactMarkdown>{this.props.content}</ReactMarkdown>
  }
}

function stripMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^### /gm, '')
    .replace(/^## /gm, '')
    .replace(/^# /gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/> /gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface NotificationRow {
  id: string
  title: string
  content: string
  type: string
  is_read: boolean
  created_at: string
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const userId = isRegisteredUser(user) ? user.id : null
  const [selectedNotification, setSelectedNotification] = useState<NotificationRow | null>(null)

  const { data: notifications, isLoading } = useQuery<NotificationRow[]>({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as NotificationRow[]
    },
  })

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('is_read', false)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', userId] })
    },
  })

  function handleSelectNotification(notification: NotificationRow) {
    setSelectedNotification(notification)
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id)
    }
  }

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0

  return (
    <div className="min-h-screen bg-neutral-50">
      <header
        className="flex shrink-0 items-center border-b border-neutral-200 bg-white px-4 pb-3"
        style={{ minHeight: 'calc(3.5625rem + var(--safe-top))', paddingTop: 'var(--safe-top)' }}
      >
        <button
          type="button"
          onClick={() => {
            if (selectedNotification) {
              setSelectedNotification(null)
            } else {
              navigate('/me')
            }
          }}
          className="flex min-h-[44px] min-w-[44px] -ml-1 items-center justify-center rounded-lg text-neutral-500 active:bg-neutral-100"
          aria-label="返回"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="ml-3 flex-1 truncate text-base font-medium">
          {selectedNotification ? selectedNotification.title : '通知'}
        </h1>
        {!selectedNotification && unreadCount > 0 && (
          <span className="text-xs text-neutral-400">{unreadCount} 条未读</span>
        )}
      </header>

      {selectedNotification ? (
        <div className="bg-white">
          <article className="px-5 py-6">
            <div className="flex items-center gap-2 mb-4">
              {selectedNotification.is_read ? (
                <MailOpen size={18} className="text-neutral-400" />
              ) : (
                <Mail size={18} className="text-orange-500" />
              )}
              <span className="text-xs text-neutral-400">{formatDate(selectedNotification.created_at)}</span>
            </div>
            <div className="text-[14px] leading-7 text-neutral-700 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:mt-8 [&>h1]:text-neutral-900 [&>h2]:text-[17px] [&>h2]:font-bold [&>h2]:mb-4 [&>h2]:mt-8 [&>h2]:text-neutral-900 [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>ul>li]:mb-2 [&>strong]:font-semibold [&>strong]:text-neutral-900 [&>blockquote]:border-l-4 [&>blockquote]:border-orange-200 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-neutral-600 [&>hr]:my-6 [&>hr]:border-neutral-200">
              <SafeMarkdown content={selectedNotification.content} />
            </div>
          </article>
        </div>
      ) : (
        <div className="p-4">
          {isLoading ? (
            <p className="text-center text-sm text-neutral-400 py-8">加载中…</p>
          ) : notifications && notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleSelectNotification(notification)}
                  className="w-full text-left rounded-2xl border border-neutral-100 bg-white p-4 active:bg-neutral-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {notification.is_read ? (
                        <MailOpen size={20} className="text-neutral-300" />
                      ) : (
                        <div className="relative">
                          <Mail size={20} className="text-orange-500" />
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${notification.is_read ? 'text-neutral-600' : 'text-neutral-900 font-medium'}`}>
                          {notification.title}
                        </p>
                        <span className="text-[11px] text-neutral-400 shrink-0">
                          {formatDate(notification.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                        {stripMarkdown(notification.content).slice(0, 80)}...
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm text-neutral-500">暂无通知</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const day = 86_400_000

  if (diffMs < day) {
    return '今天'
  }
  if (diffMs < day * 2) {
    return '昨天'
  }
  if (diffMs < day * 7) {
    return `${Math.floor(diffMs / day)} 天前`
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const dayNum = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${dayNum}`
}
