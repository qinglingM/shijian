/**
 * 统一的 App 内返回逻辑：根据当前路径解析"父级路由"。
 *
 * 设计原则：
 * - 不依赖 WebView 历史栈 (window.history)。Android WebView 的 history.idx
 *   可能包含启动页或栈底标记，按返回穿出底部就会 finish Activity，
 *   表现为"按一下返回直接退出 App"。
 * - 同一套规则同时供页面左上角返回按钮 (BackHeader) 和 Android 系统返回键
 *   (AndroidBackHandler) 使用，避免两套逻辑不一致。
 * - 一级 Tab（/map、/square、/tier-map、/me）由调用方判断 isRootTab 后
 *   各自处理：BackHeader 不会出现在一级 Tab 上；AndroidBackHandler 在
 *   /map 上最小化 App、其他一级 Tab 上回 /map。
 */

export const ROOT_TABS = ['/map', '/square', '/tier-map', '/me'] as const

const ROOT_TAB_SET: Set<string> = new Set(ROOT_TABS)

export function isRootTab(pathname: string): boolean {
  return ROOT_TAB_SET.has(pathname)
}

/**
 * 根据当前路径返回应跳转的父级路由。
 * 一级 Tab 也会返回一个合理值（/map），但调用方通常会先用 isRootTab 拦截。
 */
export function resolveParentRoute(pathname: string): string {
  // 一级 Tab：统一回 /map
  if (pathname === '/map') return '/map'
  if (pathname === '/square') return '/map'
  if (pathname === '/tier-map') return '/map'
  if (pathname === '/me') return '/map'

  // 食鉴流程：按步骤回退
  if (pathname === '/practice/step1') return '/tier-map'
  if (pathname === '/practice/step2') return '/practice/step1'
  if (pathname === '/practice/step3') return '/practice/step2'
  if (pathname === '/practice/manual') return '/practice/step1'
  if (pathname === '/practice/done') return '/tier-map'

  // 我的 子页
  if (pathname.startsWith('/me/')) return '/me'

  // 广场 子页
  if (pathname.startsWith('/square/')) return '/square'

  // 食鉴图相关
  if (pathname.startsWith('/tiers/')) return '/tier-map'
  if (pathname.startsWith('/search')) return '/tier-map'

  // 详情页（餐厅 / 菜品）：默认 /tier-map。
  // 菜品页若已加载到 restaurant_id，调用方可通过 BackHeader 的 backTo
  // 显式指定到具体餐厅页。
  if (pathname.startsWith('/restaurants/')) return '/tier-map'
  if (pathname.startsWith('/dishes/')) return '/tier-map'

  // 用户主页：无明确父级，默认回 /map
  if (pathname.startsWith('/users/')) return '/map'

  // 法务文档：从登录页进入
  if (pathname.startsWith('/legal/')) return '/auth'

  // 分享 playground
  if (pathname === '/playground/share') return '/map'

  return '/map'
}
