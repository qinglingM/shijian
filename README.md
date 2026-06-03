# 食鉴 · ShiJian

> 一款以「个人食鉴图」为核心、由 C 端用户共建的真实餐厅评价产品。

「食鉴」通过高德 POI 或手动补充确认真实店铺，但不把浏览和选择行为入库；只有用户完成包含菜品打分的有效实践后，店铺才正式进入食鉴数据库。用户成为某店首位有效实践者时获得伯乐，公开评价进入餐厅和菜品评价池，平台通过有品/野榜和好评诱导反馈维护真实评价秩序。

## 仓库结构

```
shijian/
├─ docs/                  产品 / 数据库定版说明书（由 .docx 转换而来）
├─ supabase/              后端：数据库迁移 / 种子数据 / Edge Functions
├─ web/                   前端：Vite + React + TS + Tailwind + Capacitor
│  ├─ android/            Android 原生项目（Capacitor 8）
│  └─ ios/                iOS 原生项目（Capacitor 8）
├─ .scripts/              辅助脚本
├─ 食鉴p0开发定版说明书.docx
└─ 食鉴p0 Supabase后端数据库定版说明书.docx
```

> `docs/` 下的 markdown 是 .docx 的镜像副本，以 .docx 原件为准。

## 技术栈

| 层 | 选型 | 备注 |
| --- | --- | --- |
| 前端框架 | Vite 8 + React 19 + TypeScript 6 | |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`）| |
| 路由 | React Router v7 | |
| 状态 | TanStack Query（服务端） + Zustand（本地）| |
| 动画 | Framer Motion | 页面转场、底部弹窗等 |
| 图标 | Lucide React | |
| 地图 | Leaflet + React Leaflet + Supercluster | 瓦片底图、marker 聚合 |
| 后端 | Supabase（Postgres + Auth + Storage + Edge Functions）| |
| POI | `MockPoiProvider`（默认） / `AmapPoiProvider` | |
| 移动端 | Capacitor 8（Android + iOS）| 打包为原生 App |
| 短信 | 阿里云 Dypns | 手机号验证码登录 |
| 包管理 | pnpm 11（通过 corepack）| |

## 功能总览

### 核心功能

| 功能 | 说明 |
| --- | --- |
| **全屏地图首页** | 高德瓦片底图 + 已实践餐厅头像 marker + Supercluster 聚合，点击 marker 弹出餐厅卡片 |
| **六档食鉴图** | `/tier-map` 页面，按 夯爆了/夯/顶级/人上人/NPC/拉完了 六档展示个人餐厅战利品墙 |
| **三步实践流程** | Step1 搜索确认店铺 → Step2 选择六档 → Step3 补充菜品打分，提交后餐厅正式入库 |
| **餐厅详情** | 基础信息、伯乐、标记状态、好评诱导反馈、店铺评价 Tab、菜品评价 Tab |
| **菜品详情** | 菜品信息、评分、代表锐评、有品/野榜 |
| **标记三态** | 未标记 / 已标记（想去）/ 已评价（已完成实践） |
| **有品/野榜** | 对店铺评价和菜品评价投票，综合排序（净值 = 有品 - 野榜） |
| **伯乐机制** | 某店首位完成有效实践的用户获得伯乐荣誉 |
| **好评诱导反馈** | 完成有效实践后可匿名反馈商家是否存在好评诱导行为，满足条件时在餐厅详情展示百分比 |
| **广场社交** | 发布帖子、浏览信息流、帖子详情、帖子关联实践记录 |
| **用户关注** | 关注/取消关注、他人主页、资料隐私设置 |
| **手机号登录** | 手机号 + 密码登录注册，短信验证码找回，阿里云短信服务 |
| **个人中心** | 头像上传（裁剪）、昵称/简介编辑、食鉴号、称号佩戴、设置 |
| **城市选择** | 全国城市库、定位匹配、城市切换 |
| **分享海报** | 生成餐厅分享海报（html2canvas） |
| **手动补充店铺** | 高德搜索无结果时可手动创建店铺信息 |

### 移动端（Capacitor）

| 功能 | 说明 |
| --- | --- |
| **Android** | 已配置签名构建、代码混淆、安全加固 |
| **iOS** | Xcode Cloud CI/CD，RGB 格式图标 |
| **Splash Screen** | 自定义启动屏 |
| **Status Bar** | 安全区域适配 |
| **返回键处理** | Android 返回键统一逻辑 |

## 路由清单

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | → `/map` | 默认跳转 |
| `/map` | HomeMap | 全屏地图首页 |
| `/tier-map` | HomePage | 六档食鉴图 |
| `/search` | SearchRestaurantsPage | 搜索餐厅 |
| `/square` | SquarePage | 广场信息流 |
| `/square/publish` | SquarePublishPage | 发布帖子 |
| `/square/post/:id` | PostDetailPage | 帖子详情 |
| `/practice/step1` | PracticeStep1Page | 实践 Step1：搜索确认店铺 |
| `/practice/step2` | PracticeStep2Page | 实践 Step2：选择六档 |
| `/practice/step3` | PracticeStep3Page | 实践 Step3：补充菜品 |
| `/practice/manual` | PracticeManualPage | 手动补充店铺 |
| `/practice/done` | PracticeDonePage | 实践完成页 |
| `/tiers/:tier` | TierBucketPage | 单档餐厅列表 |
| `/restaurants/:id` | RestaurantDetailPage | 餐厅详情 |
| `/restaurants/poi/:source/:poiId` | RestaurantDetailPage | 通过 POI 查看餐厅详情 |
| `/dishes/:id` | DishDetailPage | 菜品详情 |
| `/users/:slug` | UserProfilePage | 他人主页 |
| `/me` | MePage | 个人中心 |
| `/me/edit` | MeProfileEditPage | 编辑资料 |
| `/me/marks` | MarksPage | 我的标记 |
| `/me/bole` | BolePage | 我的伯乐 |
| `/me/titles` | MeTitlesPage | 我的称号 |
| `/me/settings` | MeSettingsPage | 设置 |
| `/auth` | AuthPage | 登录/注册 |
| `/legal/:slug` | LegalDocPage | 法律文档 |

## 数据库迁移

| 编号 | 文件名 | 说明 |
| --- | --- | --- |
| 0001 | enums_and_lookups | 枚举类型和基础字典 |
| 0002 | core_main_link | 核心表：restaurants, practice_records, dishes, dish_reviews |
| 0003 | marks_bole_votes | 标记、伯乐、有品/野榜投票 |
| 0004 | guidance_titles_images | 好评诱导、称号、图片资源 |
| 0005 | rls_policies | 行级安全策略 |
| 0008 | china_cities_catalog | 全国城市目录 |
| 0009 | merge_seed_city_short_aliases | 城市简称合并 |
| 0010 | profiles_phone_registration_allowlist | 手机号注册白名单 |
| 0011 | handle_new_user_phone_auth | 新用户手机号认证处理 |
| 0012 | backfill_auth_user_phone / phone_binding_exempt_mobiles | 手机号回填 / 豁免 |
| 0013 | profiles_detail_fields / backfill_display_category_label / set_auth_password | 用户资料字段 / 分类标签 / 测试密码 |
| 0014 | avatars_storage_bucket / user_follows_and_profile_visibility | 头像存储 / 关注系统 / 隐私 |
| 0015 | posts_feed | 广场帖子 / 统一投票（支持 post 类型） |
| 0016 | sync_categories_with_amap | 与高德分类同步 |
| 0017 | shijian_category_system | 食鉴分类体系 |
| 0018 | performance_composite_indexes | 性能复合索引 |
| 0019 | dish_name_max_length | 菜名长度限制 |
| 0020 | mark_poi_rpc | 标记 POI RPC |
| 0021 | restaurant_discovery_state | 餐厅发现状态 |
| 0022 | disable_anonymous | 禁用匿名用户 |
| 0023 | restaurant_feedback | 餐厅反馈 |
| 0099 | seed_100_reviews | 种子数据：100 条模拟评价 |

## 本地开发

### 前置

- Node 22+
- pnpm 11（如未安装：`corepack enable && corepack prepare pnpm@latest --activate`）

### 启动前端

```bash
cd web
cp .env.example .env.local   # 编辑后填入 Supabase 凭据
pnpm install
pnpm dev
```

默认地址：`http://localhost:5173`

### 构建移动端

```bash
# 1. 构建 web 产物
cd web
pnpm build

# 2. 同步到原生项目
pnpm cap sync android   # 或 ios

# 3. Android Debug APK（已自动签名，可直接安装）
cd android
./gradlew.bat assembleDebug
# 输出：app/build/outputs/apk/debug/app-debug.apk

# 4. Android Release APK（需配置签名）
# 见下方「Release 签名配置」
./gradlew.bat assembleRelease
```

### Release 签名配置

签名密钥和配置文件已设置，存放在 `web/android/` 目录下：

- `keystore.properties`：签名配置（已加入 .gitignore）
- `app/shijian-release.keystore`：签名密钥文件（已加入 .gitignore）

构建 Release APK：

```bash
cd web/android
./gradlew.bat assembleRelease
# 输出：app/build/outputs/apk/release/app-release.apk
```

### 应用 Supabase 迁移

进 [Supabase Dashboard](https://supabase.com/dashboard) 的 SQL Editor，按文件名顺序粘贴执行 `supabase/migrations/` 下的 SQL 文件，再执行 `supabase/seed.sql`。具体顺序、注意事项与 smoke test 见 `supabase/README.md`。

## 环境变量（`web/.env.local`）

| 变量 | 用途 | 何时必填 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL | 接入真实数据 / 登录 / 提交时必填 |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名公钥 | 接入真实数据 / 登录 / 提交时必填 |
| `VITE_POI_PROVIDER` | `mock`（默认）/ `amap` | 可选 |
| `VITE_AMAP_KEY` | 高德 Web 服务 Key | `VITE_POI_PROVIDER=amap` 时必填 |
| `VITE_AUTH_LAX_DEV` | 本地 dev 放行模式开关 | 可选 |
| `VITE_AUTH_STRICT_AUTH` | 本地强制真实登录 | 可选 |
| `VITE_FIXTURE_AUTO_LOGIN` | 使用 fixture 帐号自动登录 | 可选 |
| `VITE_FIXTURE_EMAIL` / `VITE_FIXTURE_PASSWORD` | fixture 登录凭据 | `VITE_FIXTURE_AUTO_LOGIN=true` 时必填 |
| `VITE_ENABLE_EMAIL_AUTH` | 在登录页显示研发邮箱入口 | 可选 |

## 主链路概览

```
高德 POI / 手动补充 → 确认真店
  ↓
用户提交实践单（Step1 → Step2 → Step3）
  ↓
{是否有效实践？}
  ├─ 是 → 餐厅入库 + 实践记录 + 菜评 + 判断伯乐 + 公开评价沉淀
  └─ 否 → 只存实践，不创建餐厅
  ↓
有品/野榜 + 好评诱导反馈 → 维护真实评价秩序
```

「有效实践」三要素：有真店 + 至少 1 道菜 + 至少 1 道菜有 0–10 分打分。

## 安全说明

- Release 构建已启用代码混淆（R8/ProGuard）
- Android `allowBackup` 已设为 `false`
- 文件提供者路径已限制为应用专属目录
- 签名密钥和密码未提交到 Git
- Supabase 凭据通过环境变量注入，无硬编码回退值
- 用户登出时清理本地存储（localStorage）
