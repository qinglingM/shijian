# Supabase 后端

「食鉴」P0 的后端实现。

## 目录结构

```
supabase/
├─ migrations/
│  ├─ 0001_enums_and_lookups.sql     枚举 + cities/districts/categories/titles
│  ├─ 0002_core_main_link.sql        profiles/restaurants/practice_records/dishes/dish_reviews
│  ├─ 0003_marks_bole_votes.sql      marks/bole_records/review_votes
│  ├─ 0004_guidance_titles_images.sql  好评诱导/用户称号/别名/图片
│  ├─ 0005_rls_policies.sql          所有表的 RLS 策略
│  ├─ 0008_china_cities_catalog.sql  全国城市目录 + 城市拼音
│  ├─ 0009_merge_seed_city_short_aliases.sql  合并种子城市简称
│  ├─ 0010_profiles_phone_registration_allowlist.sql  手机字段 + 邮箱豁免白名单
│  ├─ 0011_handle_new_user_phone_auth.sql  手机号注册 profile 同步
│  ├─ 0012_phone_binding_exempt_mobiles.sql  手机号豁免白名单
│  ├─ 0013_profiles_detail_fields.sql  个人资料扩展字段
│  └─ 0013_set_auth_password_for_phone_137.sql  可选：指定手机号测试帐号密码哈希
├─ seed.sql                          城市/行政区/分类/称号 种子数据
└─ functions/                        Edge Functions（含 submit-practice）
```

## 应用基础迁移（推荐）

进入你的 Supabase 项目 → **SQL Editor** → **+ New query**，按下面顺序粘贴执行：

| 顺序 | 文件 | 作用 |
| --- | --- | --- |
| 1 | `migrations/0001_enums_and_lookups.sql` | 类型系统 + 查表 |
| 2 | `migrations/0002_core_main_link.sql`    | 主链路 5 张表 + 触发器 |
| 3 | `migrations/0003_marks_bole_votes.sql`  | 治理 3 张表 |
| 4 | `migrations/0004_guidance_titles_images.sql` | 反馈 + 称号 + 别名 + 图片 |
| 5 | `migrations/0005_rls_policies.sql`      | RLS 策略 |
| 6 | `migrations/0008_china_cities_catalog.sql` | 全国城市目录与拼音 |
| 7 | `migrations/0009_merge_seed_city_short_aliases.sql` | 合并杭州/成都/广州/深圳等简称城市 |
| 8 | `migrations/0010_profiles_phone_registration_allowlist.sql` | `profiles` 手机字段 + 邮箱豁免白名单 |
| 9 | `migrations/0011_handle_new_user_phone_auth.sql` | 手机号注册时同步 `profiles.phone` |
| 10 | `migrations/0012_phone_binding_exempt_mobiles.sql` | 手机号豁免白名单 |
| 11 | `migrations/0013_profiles_detail_fields.sql` | 性别、星座、家乡、生日 |
| 12 | `seed.sql`                              | 基础数据 |

每次粘贴后点 **Run**。如果出现错误，把错误信息告诉我。

> **注**：当前仓库的迁移目录没有 `0006` / `0007` 文件；请以实际存在的 SQL 文件为准顺序执行。

> `0013_profiles_detail_fields.sql` 与 `0013_set_auth_password_for_phone_137.sql` 使用了相同编号前缀。其中 `0013_set_auth_password_for_phone_137.sql` 是个人调试脚本，包含针对指定手机号的密码哈希写入逻辑，不属于推荐基础迁移。生产环境请不要直接执行，或执行后立即改密并移除敏感历史。

> 全部执行迁移与 seed 后，**Table Editor** 里应当能看到 19 张业务表/查表（不含 Supabase Auth 自带表）。

## 验证迁移是否成功

跑一次 smoke test 脚本（在仓根目录执行）：

```powershell
py -3 .scripts/supabase_smoke.py
```

输出会显示每张表的行数和健康状态。

## 测试用户与登录

前端已有 `/auth` 登录页，默认主入口是 **手机号 + 密码登录**；注册与忘记密码流程使用 **短信验证码** 验证手机号。本地研发也可使用 fixture 自动登录或邮箱入口。

### 创建邮箱 fixture 用户

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**
2. Email: `tester@shijian.local` （或你想用的任何 email）
3. Password: 随便设一个你能记住的（比如 `Shijian2026!`）
4. ✅ 勾选 **Auto Confirm User**（跳过邮箱验证）
5. 创建后，trigger `handle_new_user` 会自动在 `profiles` 表创建对应行，你可以在 Table Editor → profiles 里看到

如需自动登录，在 `web/.env.local` 中设置：

```dotenv
VITE_FIXTURE_AUTO_LOGIN=true
VITE_FIXTURE_EMAIL=你的测试邮箱
VITE_FIXTURE_PASSWORD=你的测试密码
```

若要在登录页显示邮箱入口，设置 `VITE_ENABLE_EMAIL_AUTH=true`。

### 手机号 OTP 与 profile 同步（`migrations/0011_handle_new_user_phone_auth.sql`）

- 在用户通过 **手机号 + 短信验证码** 登录/注册后，`handle_new_user` 会写入 **`profiles.phone`**，并尽量同步 **`phone_verified_at`**（来自 `auth.users.phone_confirmed_at`）。
- **Phone 认证** 与 **短信服务商** 须在 Dashboard → **Authentication → Providers → Phone** 中配置，否则前端无法收到短信。

### 手机号与研发预留帐号（`migrations/0010_profiles_phone_registration_allowlist.sql`）

- **`profiles.phone` / `phone_verified_at`**：为未来「短信 OTP 绑定 / 校验」预留；验证码流程上线后再由服务端或函数写入。
- **`profiles.phone_binding_exempt`**：为 **true** 时，产品上可暂不强制走完手机号绑定；由注册时触发器依据邮箱自动设置。
- **`registration_phone_allowlist`**：与白名单邮箱（全小写比较、去首尾空格）匹配即可在注册时将 `phone_binding_exempt=true`。迁移内置 5 个占位邮箱：`dev-shijian-1@local.dev` … `dev-shijian-5@local.dev`。请在 Dashboard **Authentication → Users** 中用**相同邮箱**创建用户，或按需改表里 email 后再注册。
- **RLS**：白名单表不对外开放 `select`/`insert`/`update`/`delete` policy，请在 SQL Editor（具备足够权限）或 Table Editor（service_role）里维护列表。

### 正式上线前

将占位邮箱改写为你的团队测试邮箱或改为空表按需插入；未在白名单的普通用户应保持 `phone_binding_exempt=false`，以便上线后产品与 Edge 函数统一校验「已绑定手机号 + 已通过短信校验」的策略。

## 与里程碑的对应关系

| 里程碑 | 产出 |
| --- | --- |
| M2 | 主链路表 + 索引 + 触发器 + RLS + 种子数据 |
| M5 | `functions/submit-practice/` Edge Function |
| M7 | 前端治理能力：门店伯乐、我的标记、有品/野榜、好评诱导反馈 |
| M8 | 全国城市目录、手机号认证兼容、个人资料扩展 |

## M5 提交函数部署

`submit-practice` 会使用当前登录用户校验身份，再用 `service_role` 写入餐厅、实践单、菜品、菜评、伯乐记录。

```powershell
supabase functions deploy submit-practice
```

部署后确认 Supabase 项目里存在这些 Edge Function 环境变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

云端一般由 Supabase 自动注入上述变量。

### 前端「连不上 submit-practice」或 FunctionsFetchError

表示浏览器到 `{项目 URL}/functions/v1/submit-practice` **未建立成功连接**。请逐项检查：

1. **是否已部署函数**：控制台 Edge Functions 中应有 `submit-practice`；否则在仓库根执行 `supabase login`、`supabase link --project-ref <ref>`、`supabase functions deploy submit-practice`。
2. **`.env.local` 是否同源**：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 须与部署该函数的**同一** Supabase 项目一致（通常为 `https://<ref>.supabase.co`）。
3. **本地 CLI**：若 `supabase start`，前端 URL 常为 `http://127.0.0.1:54321`，并需另开终端运行 `supabase functions serve submit-practice`（或等价 serve）。
4. **网络**：部分网络下 Functions 网关不可达时可换网络/代理后再试。
5. 若已是 **HTTP 错误**（有状态码）：401 多为未登录；404 多为未部署函数名；500 见控制台函数日志。
