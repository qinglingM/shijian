type ImportMetaEnv = {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_POI_PROVIDER?: 'mock' | 'amap'
  readonly VITE_AMAP_KEY?: string
}

const env = import.meta.env as ImportMetaEnv

export const SUPABASE_URL = env.VITE_SUPABASE_URL ?? 'https://jpdnnfbxcgdjhpwcchqd.supabase.co'
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_fFqF2gk7FRN5hXoIrBWG-Q_6Dx8zWaL'
export const POI_PROVIDER = env.VITE_POI_PROVIDER ?? 'amap'
export const AMAP_KEY = env.VITE_AMAP_KEY ?? '92ca168e630c0fac589f3f253049c36c'

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
