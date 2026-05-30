import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BackHeader } from '@/components/layout/AppLayout'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface UserTitleRow {
  id: string
  title_id: string
  titles: { name: string; rarity: string; description: string | null }
}

export function MeTitlesPage() {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const queryClient = useQueryClient()
  const [equipping, setEquipping] = useState<string | null>(null)

  const { data: userTitles = [], isLoading } = useQuery<UserTitleRow[]>({
    queryKey: ['my-titles', userId],
    enabled: isSupabaseConfigured && !!userId,
    queryFn: async () => {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('user_titles')
        .select('id, title_id, titles!inner(name, rarity, description)')
        .eq('user_id', userId!)
      if (error) throw error
      return (data ?? []) as unknown as UserTitleRow[]
    },
  })

  const { data: profile } = useQuery({
    queryKey: ['my-title-equipped', userId],
    enabled: isSupabaseConfigured && !!userId,
    queryFn: async () => {
      const sb = getSupabase()
      const { data, error } = await sb
        .from('profiles')
        .select('current_title_id')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return data as { current_title_id: string | null }
    },
  })

  const equipMut = useMutation({
    mutationFn: async (titleId: string) => {
      const sb = getSupabase()
      const { error } = await sb
        .from('profiles')
        .update({ current_title_id: titleId })
        .eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-title-equipped', userId] })
      queryClient.invalidateQueries({ queryKey: ['me-summary', userId] })
    },
    onSettled: () => setEquipping(null),
  })

  const unequipMut = useMutation({
    mutationFn: async () => {
      const sb = getSupabase()
      const { error } = await sb
        .from('profiles')
        .update({ current_title_id: null })
        .eq('id', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-title-equipped', userId] })
      queryClient.invalidateQueries({ queryKey: ['me-summary', userId] })
    },
  })

  const equippedId = profile?.current_title_id ?? null

  function rarityColor(rarity: string) {
    const map: Record<string, string> = {
      common: 'bg-neutral-100 text-neutral-600',
      rare: 'bg-sky-100 text-sky-700',
      epic: 'bg-indigo-100 text-indigo-700',
      legendary: 'bg-amber-100 text-amber-700',
    }
    return map[rarity] ?? 'bg-neutral-100 text-neutral-600'
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-12">
      <BackHeader title="我的称号" backTo="/me" />

      {isLoading ? (
        <p className="px-5 py-14 text-center text-sm font-medium text-neutral-400">载入称号…</p>
      ) : userTitles.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/50">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-neutral-300">
              <path d="M12 2L4 6v5c0 4.5 3.5 8.8 8 10 4.5-1.2 8-5.5 8-10V6l-8-4z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>
          <h3 className="text-[15px] font-bold text-neutral-800">暂无称号</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
            完成特定成就或参与早期注册即可获得称号。
          </p>
        </div>
      ) : (
        <div className="px-4 py-6 space-y-3">
          {userTitles.map((ut) => {
            const isEquipped = ut.title_id === equippedId
            return (
              <div
                key={ut.id}
                className={`rounded-2xl border px-4 py-3.5 ${
                  isEquipped ? 'border-indigo-200 bg-indigo-50/50' : 'border-neutral-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{ut.titles.name}</p>
                      <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-semibold ${rarityColor(ut.titles.rarity)}`}>
                        {ut.titles.rarity === 'common' ? '普通' : ut.titles.rarity === 'rare' ? '稀有' : ut.titles.rarity === 'epic' ? '史诗' : '传说'}
                      </span>
                    </div>
                    {ut.titles.description && (
                      <p className="mt-1 text-xs text-neutral-500">{ut.titles.description}</p>
                    )}
                  </div>

                  {isEquipped ? (
                    <button
                      type="button"
                      disabled={unequipMut.isPending}
                      onClick={() => unequipMut.mutate()}
                      className="shrink-0 rounded-full border border-neutral-200 px-3 py-1 text-[11px] text-neutral-500 active:bg-neutral-100 disabled:opacity-50"
                    >
                      卸下
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={equipping === ut.title_id}
                      onClick={() => { setEquipping(ut.title_id); equipMut.mutate(ut.title_id) }}
                      className="shrink-0 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm active:opacity-80 disabled:opacity-50"
                    >
                      佩戴
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
