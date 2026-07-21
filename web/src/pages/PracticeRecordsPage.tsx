import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, MoreVertical, Eye, EyeOff, Trash2 } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { isRegisteredUser } from '@/features/auth/useRequireLogin'
import { useAndroidBackDismiss } from '@/components/layout/AndroidBackHandler'
import { deletePracticeContent } from '@/features/practice/deletePracticeContent'

interface PracticeRecordRow {
  id: string
  restaurant_id: string
  tier: string
  store_comment: string | null
  is_public: boolean
  is_active: boolean
  created_at: string
  restaurants: {
    display_name: string
    cover_image_url: string | null
    poi_source: string | null
    poi_id: string | null
  } | null
  dish_reviews: Array<{
    id: string
    dish_id: string
    score: number | null
    comment: string | null
    image_url: string | null
    is_public: boolean
    is_active?: boolean
    dishes: {
      name: string
      cover_image_url: string | null
    } | null
  }>
}

export function PracticeRecordsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const userId = isRegisteredUser(user) ? user.id : null
  const [actionMenu, setActionMenu] = useState<{ type: 'practice' | 'dish'; recordId: string; dishId?: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'toggle' | 'delete'; recordId: string; dishId?: string; currentPublic?: boolean } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  useAndroidBackDismiss(!!actionMenu, () => setActionMenu(null))
  useAndroidBackDismiss(!!confirmAction, () => setConfirmAction(null))

  const { data: practices, isLoading } = useQuery<PracticeRecordRow[]>({
    queryKey: ['me-practices', userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('practice_records')
        .select(`
          id,
          restaurant_id,
          tier,
          store_comment,
          is_public,
          is_active,
          created_at,
          restaurants(display_name, cover_image_url, poi_source, poi_id),
          dish_reviews(
            id,
            dish_id,
            score,
            comment,
            image_url,
            is_public,
            dishes(name, cover_image_url)
          )
        `)
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as unknown as PracticeRecordRow[]
    },
  })

  async function handleTogglePrivacy(recordId: string, dishId: string | undefined, currentPublic: boolean) {
    setActionLoading(true)
    try {
      const supabase = getSupabase()
      if (dishId) {
        const { error } = await supabase
          .from('dish_reviews')
          .update({ is_public: !currentPublic })
          .eq('id', dishId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('practice_records')
          .update({ is_public: !currentPublic })
          .eq('id', recordId)
        if (error) throw error
      }
      await queryClient.invalidateQueries({ queryKey: ['me-practices', userId] })
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
      setActionMenu(null)
    }
  }

  async function handleDelete(recordId: string, dishId: string | undefined) {
    setActionLoading(true)
    try {
      await deletePracticeContent({ recordId, dishId })
      await queryClient.invalidateQueries({ queryKey: ['me-practices', userId] })
      await queryClient.invalidateQueries({ queryKey: ['me-summary', userId] })
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
      setActionMenu(null)
    }
  }

  return (
    <div className="min-h-full bg-neutral-50">
      <header
        className="sticky top-0 z-40 flex shrink-0 items-center border-b border-neutral-200 bg-white px-4 pb-3"
        style={{ minHeight: 'calc(3.5625rem + var(--safe-top))', paddingTop: 'var(--safe-top)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/me')}
          className="flex min-h-[44px] min-w-[44px] -ml-1 items-center justify-center rounded-lg text-neutral-500 active:bg-neutral-100"
          aria-label="返回"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="ml-3 flex-1 truncate text-base font-medium">评价记录</h1>
      </header>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <p className="text-center text-sm text-neutral-400 py-8">加载中…</p>
        ) : practices && practices.length > 0 ? (
          practices.map((record) => (
            <div key={record.id} className="rounded-2xl border border-neutral-100 overflow-hidden bg-white">
              {/* 餐厅头部 */}
              <div className="flex items-start gap-3 p-3">
                <div
                  className="w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer"
                  onClick={() => record.restaurants && navigate(`/restaurants/${record.restaurant_id}`)}
                >
                  {record.restaurants?.cover_image_url ? (
                    <img
                      src={record.restaurants.cover_image_url}
                      alt={record.restaurants.display_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                      <span className="text-2xl">🍽️</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium text-neutral-900 truncate cursor-pointer active:text-orange-600"
                    onClick={() => record.restaurants && navigate(`/restaurants/${record.restaurant_id}`)}
                  >
                    {record.restaurants?.display_name ?? '未知门店'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">{tierLabel(record.tier)}</p>
                  {record.store_comment ? (
                    <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{record.store_comment}</p>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActionMenu(actionMenu?.recordId === record.id ? null : { type: 'practice', recordId: record.id })}
                    className="p-1.5 rounded-lg active:bg-neutral-100"
                    aria-label="更多操作"
                  >
                    <MoreVertical size={16} className="text-neutral-400" />
                  </button>
                </div>
              </div>

              {/* 菜品列表 */}
              {record.dish_reviews && record.dish_reviews.filter((d) => d.is_active !== false).length > 0 ? (
                <div className="border-t border-neutral-100">
                  {record.dish_reviews.filter((d) => d.is_active !== false).map((review) => (
                    <div key={review.id} className="flex items-start gap-3 px-3 py-2.5 border-b border-neutral-50 last:border-b-0">
                      <div className="flex items-center gap-2 shrink-0">
                        {review.score !== null && review.score !== undefined && (
                          <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shrink-0">
                            {review.score}分
                          </span>
                        )}
                        {review.dishes?.cover_image_url ? (
                          <img
                            src={review.dishes.cover_image_url}
                            alt={review.dishes.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-neutral-50 flex items-center justify-center shrink-0">
                            <span className="text-lg">🍜</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-neutral-900 truncate">
                            {review.dishes?.name ?? '未知菜品'}
                          </p>
                          {!review.is_public && (
                            <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                              私密
                            </span>
                          )}
                        </div>
                        {review.comment ? (
                          <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">{review.comment}</p>
                        ) : null}
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActionMenu(actionMenu?.dishId === review.id ? null : { type: 'dish', recordId: record.id, dishId: review.id })}
                          className="p-1 rounded-lg active:bg-neutral-100"
                          aria-label="更多操作"
                        >
                          <MoreVertical size={14} className="text-neutral-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-sm text-neutral-500">暂无评价记录</p>
            <p className="text-xs text-neutral-400 mt-1">完成一次食鉴后，记录会出现在这里</p>
          </div>
        )}
      </div>

      {/* 操作菜单浮层 - 点击外部关闭 */}
      {actionMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setActionMenu(null)} />
          {actionMenu.type === 'practice' ? (
            practices?.filter((r) => r.id === actionMenu.recordId).map((record) => (
              <div key={record.id} className="fixed z-50" style={{ top: 'var(--menu-top, 5rem)', right: '1rem' }}>
                <PracticeActionMenu
                  isPublic={record.is_public}
                  onToggle={() => setConfirmAction({ type: 'toggle', recordId: record.id, currentPublic: record.is_public })}
                  onDelete={() => setConfirmAction({ type: 'delete', recordId: record.id })}
                />
              </div>
            ))
          ) : (() => {
            const dishReview = practices?.flatMap((r) => r.dish_reviews).find((d) => d.id === actionMenu.dishId)
            return dishReview ? (
              <div className="fixed z-50" style={{ top: 'var(--menu-top, 8rem)', right: '1rem' }}>
                <DishActionMenu
                  isPublic={dishReview.is_public}
                  onToggle={() => setConfirmAction({ type: 'toggle', recordId: actionMenu.recordId, dishId: dishReview.id, currentPublic: dishReview.is_public })}
                  onDelete={() => setConfirmAction({ type: 'delete', recordId: actionMenu.recordId, dishId: dishReview.id })}
                />
              </div>
            ) : null
          })()}
        </>
      )}

      {/* 确认操作弹窗 */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            {confirmAction.type === 'toggle' ? (
              <>
                <p className="text-base font-medium text-neutral-900">
                  {confirmAction.currentPublic ? '设为私密？' : '设为公开？'}
                </p>
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  {confirmAction.currentPublic
                    ? confirmAction.dishId
                      ? '该菜品评价将仅自己可见'
                      : '该餐厅评价及所有菜品评价将仅自己可见'
                    : confirmAction.dishId
                      ? '该菜品评价将对其他人可见'
                      : '该餐厅评价及所有菜品评价将对其他人可见'}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 size={18} className="text-rose-500" />
                  <p className="text-base font-medium text-neutral-900">
                    {confirmAction.dishId ? '删除菜品评价？' : '删除餐厅评价？'}
                  </p>
                </div>
                <p className="text-xs leading-5 text-neutral-500">
                  {confirmAction.dishId
                    ? '删除后不可恢复'
                    : '删除后，该餐厅的所有菜品评价也将被删除，且不可恢复。'}
                </p>
              </>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm text-neutral-700"
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
              >
                取消
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white shadow-sm ${
                  confirmAction.type === 'delete'
                    ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                } disabled:opacity-50`}
                onClick={() => {
                  if (confirmAction.type === 'toggle') {
                    handleTogglePrivacy(confirmAction.recordId, confirmAction.dishId, confirmAction.currentPublic ?? true)
                  } else {
                    handleDelete(confirmAction.recordId, confirmAction.dishId)
                  }
                }}
                disabled={actionLoading}
              >
                {actionLoading ? '处理中…' : confirmAction.type === 'delete' ? '确认删除' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PracticeActionMenu({
  isPublic,
  onToggle,
  onDelete,
}: {
  isPublic: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="w-36 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-neutral-700 active:bg-neutral-50"
      >
        {isPublic ? <EyeOff size={14} /> : <Eye size={14} />}
        {isPublic ? '设为私密' : '设为公开'}
      </button>
      <div className="h-px bg-neutral-100" />
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-rose-500 active:bg-neutral-50"
      >
        <Trash2 size={14} />
        删除评价
      </button>
    </div>
  )
}

function DishActionMenu({
  isPublic,
  onToggle,
  onDelete,
}: {
  isPublic: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="w-36 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-neutral-700 active:bg-neutral-50"
      >
        {isPublic ? <EyeOff size={14} /> : <Eye size={14} />}
        {isPublic ? '设为私密' : '设为公开'}
      </button>
      <div className="h-px bg-neutral-100" />
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-rose-500 active:bg-neutral-50"
      >
        <Trash2 size={14} />
        删除菜品
      </button>
    </div>
  )
}

function tierLabel(tier: string) {
  const map: Record<string, string> = {
    boom: '夯爆了',
    hang: '夯',
    top: '顶级',
    upper: '人上人',
    npc: 'NPC',
    bad: '拉完了',
  }
  return map[tier] ?? tier
}
