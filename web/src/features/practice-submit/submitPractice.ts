import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'
import type { Tier } from '@/lib/db'
import { SUPABASE_URL } from '@/lib/env'
import { getSupabase } from '@/lib/supabase'
import type { PoiCandidate } from '@/lib/poi'
import type { DraftDishReview, ManualRestaurantInfo } from '@/stores/practiceDraft'

export interface SubmitPracticeDraft {
  existing_restaurant_id: string | null
  selected_poi: PoiCandidate | null
  manual_restaurant: ManualRestaurantInfo | null
  tier: Tier | null
  store_comment: string
  is_public: boolean
  good_review_guidance: boolean
  dishes: DraftDishReview[]
}

export interface SubmitPracticeResult {
  restaurant_id: string
  practice_record_id: string
  dish_review_ids: string[]
  is_valid_practice: boolean
}

function edgeInvokeTroubleshootHint(): string {
  const origin = SUPABASE_URL ? new URL(SUPABASE_URL).origin : '(未配置 VITE_SUPABASE_URL)'
  return [
    `当前请求发往：${origin}/functions/v1/submit-practice`,
    '',
    '若提示无法连接网络：',
    '1）在 Supabase 控制台 → Edge Functions 确认已部署「submit-practice」；或在仓库根目录执行：',
    '   supabase login && supabase link --project-ref <你的项目 ref>',
    '   supabase functions deploy submit-practice',
    '2）确认 web/.env.local 里的 VITE_SUPABASE_URL / ANON KEY 与该函数所在项目一致，URL 形如 https://xxx.supabase.co（勿带多余路径）。',
    '3）本地可选：supabase start 后将 VITE_SUPABASE_URL 设为 http://127.0.0.1:54321，并在另一终端执行 supabase functions serve。',
    '4）在中国大陆网络环境下，若其它 Supabase API 正常但 Functions 超时，可尝试切换网络或使用系统代理后再试。',
  ].join('\n')
}

export async function submitPractice(
  draft: SubmitPracticeDraft,
): Promise<SubmitPracticeResult> {
  if (!draft.tier) throw new Error('请选择档位')
  if (draft.dishes.some((d) => d.name.trim() === '')) {
    throw new Error('请为每道菜填写菜名，或删除未填写的菜品')
  }

  const payload = {
    existing_restaurant_id: draft.existing_restaurant_id,
    selected_poi: draft.selected_poi,
    manual_restaurant: draft.manual_restaurant,
    tier: draft.tier,
    store_comment: draft.store_comment,
    is_public: draft.is_public,
    good_review_guidance: draft.good_review_guidance,
    dishes: draft.dishes.map((dish) => ({
      dish_id: dish.dish_id,
      name: dish.name,
      score: dish.score,
      comment: dish.comment,
      image_url: dish.image_url,
      is_public: dish.is_public,
    })),
  }

  const { data, error } = await getSupabase().functions.invoke<SubmitPracticeResult>(
    'submit-practice',
    { body: payload },
  )

  if (error) {
    if (error instanceof FunctionsFetchError) {
      throw new Error(
        `${edgeInvokeTroubleshootHint()}\n\n（底层：${error.name} — ${error.message}）`,
      )
    }
    if (error instanceof FunctionsRelayError) {
      throw new Error(
        `Edge Function 中继失败：${error.message}\n若持续出现，请稍后在 Supabase 状态页或控制台查看 Functions 是否可用。`,
      )
    }
    if (error instanceof FunctionsHttpError) {
      let serverText: string
      try {
        const clone = error.context.clone()
        const ct = clone.headers.get('content-type') ?? ''
        if (ct.includes('application/json')) {
          const body = (await clone.json()) as { error?: unknown; message?: unknown }
          serverText =
            (typeof body?.error === 'string' && body.error) ||
            (typeof body?.message === 'string' && body.message) ||
            JSON.stringify(body)
        } else {
          serverText = (await clone.text()).slice(0, 500)
        }
      } catch {
        serverText = error.message
      }
      throw new Error(
        `submit-practice 返回 HTTP ${error.context.status}${serverText ? `：${serverText}` : ''}\n若为 401，请先登录；若为 404，多为函数未部署；若为 500，请看 Dashboard → Edge Functions → 日志里的 service_role / 运行时错误。`,
      )
    }
    throw error
  }
  if (!data) throw new Error('提交失败：服务端没有返回结果')
  return data
}
