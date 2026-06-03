import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { keyword, city, page = 1, pageSize = 20 } = await req.json()

    const amapKey = requiredEnv('AMAP_KEY')

    const params = new URLSearchParams({
      key: amapKey,
      keywords: keyword?.trim() ?? '',
      types: '050000',
      offset: String(pageSize),
      page: String(page),
      extensions: 'all',
    })
    if (city?.trim()) {
      params.set('city', city.trim())
      params.set('citylimit', 'true')
    }

    const res = await fetch(`https://restapi.amap.com/v3/place/text?${params.toString()}`, {
      method: 'GET',
    })

    if (!res.ok) {
      return json({ error: `高德 POI：HTTP ${res.status}` }, res.status)
    }

    const text = await res.text()
    let amapJson: Record<string, unknown>
    try {
      amapJson = JSON.parse(text)
    } catch {
      return json({ error: '高德 POI 返回格式异常' }, 502)
    }

    if (amapJson.status !== '1' || !Array.isArray(amapJson.pois)) {
      return json({ error: `高德 POI：${(amapJson.info as string) ?? '返回异常'}` }, 502)
    }

    return json(amapJson)
  } catch (err) {
    console.error('[poi-search]', err)
    return json({ error: 'POI 搜索失败，请稍后重试' }, 500)
  }
})
