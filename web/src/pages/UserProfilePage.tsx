import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronRight, MapPin, UserRound } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { getSupabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useFollowMutation } from '@/features/social/useFollowMutation'
import { useFollowStatus } from '@/features/social/useFollowStatus'
import { useCityStore } from '@/features/city-picker/cityStore'
import { TIER_LABEL, type Tier } from '@/lib/db'

interface ProfileSummary {
  id: string
  user_code: string
  nickname: string
  avatar_url: string | null
  bio: string | null
  city_id: string | null
  current_title_id: string | null
  is_profile_public: boolean
}

interface PracticeRecordJoin {
  id: string
  restaurant_id: string
  tier: string
  store_comment: string | null
  created_at: string
  restaurants: {
    display_name: string
    cover_image_url: string | null
    city_name: string | null
    district_name: string | null
    address_text: string | null
    city_id: string | null
  } | null
}

interface UserReviewItem {
  practice_id: string
  restaurant_id: string
  restaurant_name: string
  restaurant_cover: string | null
  restaurant_city_name: string | null
  restaurant_district_name: string | null
  restaurant_address: string | null
  tier: Tier
  store_comment: string | null
  created_at: string
}

export function UserProfilePage() {
  const params = useParams()
  const raw = params.slug ?? null
  const cityId = useCityStore((s) => s.cityId)
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all')
  const [cityFilter, setCityFilter] = useState<string | null>(null)

  const profileQ = useQuery({
    queryKey: ['user-profile', raw],
    enabled: !!raw,
    queryFn: async () => {
      const sb = getSupabase()
      if (!raw) return null

      const q = raw.startsWith('u_')
        ? sb.from('profiles').select('id, user_code, nickname, avatar_url, bio, city_id, current_title_id, is_profile_public').eq('id', raw)
        : sb.from('profiles').select('id, user_code, nickname, avatar_url, bio, city_id, current_title_id, is_profile_public').eq('user_code', raw)

      const { data, error } = await q.maybeSingle()
      if (error) throw error
      return (data as ProfileSummary | null) ?? null
    },
  })

  const targetUserId = profileQ.data?.id ?? null
  const followQ = useFollowStatus(targetUserId)
  const followMut = useFollowMutation(targetUserId)

  const reviewsQ = useQuery({
    queryKey: ['user-profile-reviews', targetUserId, cityId, cityFilter, tierFilter],
    enabled: !!targetUserId,
    queryFn: async () => {
      const sb = getSupabase()
      let q = sb
        .from('practice_records')
        .select('id, restaurant_id, tier, store_comment, created_at, restaurants(id, display_name, cover_image_url, city_name, district_name, address_text, city_id)')
        .eq('user_id', targetUserId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50)
      if (tierFilter !== 'all') q = q.eq('tier', tierFilter)
      if (cityFilter) q = q.eq('restaurants.city_id', cityFilter)
      else if (cityId) q = q.eq('restaurants.city_id', cityId)
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as unknown as PracticeRecordJoin[]
      return rows.map((r) => ({
        practice_id: r.id,
        restaurant_id: r.restaurant_id,
        restaurant_name: r.restaurants?.display_name ?? '餐厅',
        restaurant_cover: r.restaurants?.cover_image_url ?? null,
        restaurant_city_name: r.restaurants?.city_name ?? null,
        restaurant_district_name: r.restaurants?.district_name ?? null,
        restaurant_address: r.restaurants?.address_text ?? null,
        tier: r.tier as Tier,
        store_comment: r.store_comment,
        created_at: r.created_at,
      })) as UserReviewItem[]
    },
  })

  const profile = profileQ.data
  const reviewItems = reviewsQ.data ?? []
  const countsText = useMemo(() => {
    return `${followQ.data?.followers ?? 0} 粉丝 · ${followQ.data?.followingCount ?? 0} 关注`
  }, [followQ.data?.followers, followQ.data?.followingCount])

  if (profileQ.isLoading) {
    return <div className="px-4 py-16 text-center text-sm text-neutral-400">载入主页…</div>
  }

  if (!profile) {
    return <Navigate to="/" replace />
  }

  const isOwner = followQ.data?.isSelf ?? false
  const isPrivate = !profile.is_profile_public && !isOwner
  const activeTierLabel = tierFilter === 'all' ? '全部档位' : (TIER_LABEL[tierFilter] ?? '全部档位')
  const activeCityLabel = cityFilter ? '当前筛选城市' : cityId ? '当前城市' : '全部城市'

  return (
    <div className="bg-white pb-8">
      <BackHeader title="用户主页" />

      <section className="px-4 pt-4">
        <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50/70 to-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.nickname} className="size-16 rounded-full object-cover" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-white text-orange-600 ring-1 ring-orange-100">
                <UserRound size={30} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-semibold text-neutral-950">{profile.nickname}</p>
              <p className="mt-1 text-xs text-neutral-500">食鉴号 {profile.user_code}</p>
              <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{profile.bio || '这个人还没有写简介。'}</p>
              <p className="mt-3 text-xs text-neutral-500">{countsText}</p>
            </div>
            {!isOwner ? (
              <button
                type="button"
                onClick={() => followMut.mutate(followQ.data?.following ?? false)}
                className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                {followQ.data?.following ? '取关' : '关注'}
              </button>
            ) : null}
          </div>
          {isOwner ? (
            <div className="mt-4 flex gap-2">
              <Link to="/me/edit" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200">
                编辑资料
              </Link>
              <Link to="/me" className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                我的主页
              </Link>
            </div>
          ) : null}
          {!profile.is_profile_public && !isOwner ? (
            <p className="mt-4 rounded-2xl bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
              该用户已关闭主页公开展示。
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-4 px-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-50 p-1.5">
          <button className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 shadow-sm ring-1 ring-orange-100">店铺评价</button>
          <button
            type="button"
            onClick={() => setCityFilter((v) => (v ? null : cityId))}
            className="rounded-full bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm ring-1 ring-neutral-200"
          >
            {activeCityLabel}
          </button>
          <button
            type="button"
            onClick={() => setTierFilter((v) => (v === 'all' ? 'boom' : v === 'boom' ? 'hang' : v === 'hang' ? 'top' : v === 'top' ? 'upper' : v === 'upper' ? 'npc' : v === 'npc' ? 'bad' : 'all'))}
            className="rounded-full bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm ring-1 ring-neutral-200"
          >
            {activeTierLabel}
          </button>
        </div>
      </section>

      <section className="mt-4 px-4">
        {isPrivate ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
            该主页仅对自己可见。
          </div>
        ) : (
          <div className="space-y-3">
            {reviewItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
                这个用户还没有公开的店铺评价。
              </p>
            ) : (
              reviewItems.map((item) => (
                <Link
                  key={item.practice_id}
                  to={`/restaurants/${item.restaurant_id}`}
                  className="block rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm shadow-black/[0.04] active:bg-neutral-50"
                >
                  <div className="flex gap-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100">
                      {item.restaurant_cover ? (
                        <img src={item.restaurant_cover} alt="" className="size-full object-cover" />
                      ) : (
                        <MapPin className="size-6 text-orange-500" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-950">
                          {item.restaurant_name}
                        </h3>
                        <ChevronRight className="mt-0.5 size-4 shrink-0 text-neutral-300" aria-hidden />
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-neutral-600">
                        {item.store_comment || '这个评价还没有锐评。'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 font-semibold text-orange-700 ring-1 ring-orange-100">
                          {TIER_LABEL[item.tier]}
                        </span>
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                          {item.restaurant_city_name || '城市未知'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  )
}
