import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/env'

let _client: SupabaseClient | null = null

/**
 * No-op lock：跳过 supabase-js 默认的 navigator.locks 串行化。
 *
 * 默认锁的问题：
 *   1) Playwright 持久化 user-data-dir 时，同名锁可能被遗留导致 hang
 *   2) 多 tab 场景在 P0 dev 不存在，因此完全无副作用
 */
const noopLock = async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn()

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase 未配置：请在 web/.env.local 设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY',
    )
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // 启用后，邮件重置密码等跳转链接中的会话会被解析入库
        detectSessionInUrl: true,
        lock: noopLock,
      },
    })
  }
  return _client
}

export { isSupabaseConfigured }
