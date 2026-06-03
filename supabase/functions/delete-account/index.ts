import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`缺少 Edge Function 环境变量：${name}`)
  return value
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: '只支持 POST' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = requiredEnv('SUPABASE_URL')
    const anonKey = requiredEnv('SUPABASE_ANON_KEY')
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: '请先登录' }, 401)
    }

    const { password } = await req.json()
    if (!password || typeof password !== 'string') {
      return json({ error: '请输入密码' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const userId = userData.user.id

    // 验证密码：尝试用手机号+密码登录
    const phone = userData.user.phone
    if (!phone) {
      return json({ error: '仅支持手机号登录的账号注销' }, 400)
    }

    const { error: signInError } = await createClient(supabaseUrl, anonKey).auth.signInWithPassword({
      phone,
      password,
    })
    if (signInError) {
      return json({ error: '密码错误' }, 401)
    }

    // 删除用户数据（按依赖顺序）
    // 1. 删除 good_review_guidance_feedbacks
    await admin.from('good_review_guidance_feedbacks').delete().eq('user_id', userId)

    // 2. 删除 user_follows（关注和被关注）
    await admin.from('user_follows').delete().eq('follower_id', userId)
    await admin.from('user_follows').delete().eq('following_id', userId)

    // 3. 删除 posts
    await admin.from('posts').delete().eq('user_id', userId)

    // 4. 删除 user_titles
    await admin.from('user_titles').delete().eq('user_id', userId)

    // 5. 删除 review_votes
    await admin.from('review_votes').delete().eq('user_id', userId)

    // 6. 删除 dish_reviews（通过 practice_records 关联）
    const { data: practices } = await admin.from('practice_records').select('id').eq('user_id', userId)
    if (practices && practices.length > 0) {
      const practiceIds = practices.map((p) => p.id)
      await admin.from('dish_reviews').delete().in('practice_record_id', practiceIds)
    }

    // 7. 删除 practice_records
    await admin.from('practice_records').delete().eq('user_id', userId)

    // 8. 删除 marks
    await admin.from('marks').delete().eq('user_id', userId)

    // 9. 删除 bole_records
    await admin.from('bole_records').delete().eq('user_id', userId)

    // 10. 删除 image_assets
    await admin.from('image_assets').delete().eq('owner_id', userId)

    // 11. 删除 profiles
    await admin.from('profiles').delete().eq('id', userId)

    // 12. 删除 auth.users（使用 Admin API）
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      console.error('[delete-account] Failed to delete auth user:', deleteUserError.message)
    }

    return json({ success: true, message: '账号已注销' })
  } catch (err) {
    console.error('[delete-account]', err)
    return json({ error: '注销失败，请稍后重试' }, 500)
  }
})
