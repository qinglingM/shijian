type ImportMetaEnv = {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_FUNCTIONS_URL?: string
  readonly VITE_POI_PROVIDER?: 'mock' | 'amap' | 'edge'
  readonly VITE_AMAP_KEY?: string
  readonly VITE_ENABLE_REPORT_TEST_FIXTURES?: string
}

const env = import.meta.env as ImportMetaEnv

export const SUPABASE_URL = env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? ''
export const SUPABASE_FUNCTIONS_URL = env.VITE_SUPABASE_FUNCTIONS_URL ?? ''
export const POI_PROVIDER = env.VITE_POI_PROVIDER ?? 'mock'
export const AMAP_KEY = env.VITE_AMAP_KEY ?? ''

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
