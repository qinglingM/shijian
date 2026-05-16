/** 城市列表数据来源状态（用于城市选择弹窗提示） */
export type CitiesSourceStatus =
  | { kind: 'ok' }
  | { kind: 'no_supabase' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty_db' }
