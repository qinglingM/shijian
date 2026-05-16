-- ====================================================================
-- 0010 · profiles 手机号字段 +「免强制绑定手机号」研发预留邮箱名单
-- ====================================================================
-- 说明：
--   * profiles.phone：存绑定后的手机号（格式后续与短信网关统一，可先按 E.164 或大陆 11 位）
--   * profiles.phone_verified_at：最近一次短信校验通过时间（未接短信时为 null）
--   * profiles.phone_binding_exempt：为 true 时产品侧可走「暂不强制手机」流程（仅限名单内邮箱注册）
--   * registration_phone_allowlist：允许的邮箱字面量列表；handle_new_user 根据 auth.users.email 匹配
--   使用前请将下列占位邮箱改为你准备在 Supabase Authentication 里创建的测试帐号邮箱，
--   或在入库后再用 Dashboard / SQL 改动 allowlist。
--   本脚本可重复执行（表 IF NOT EXISTS；列 IF NOT EXISTS；insert ON CONFLICT DO NOTHING）。
-- ====================================================================

create table if not exists public.registration_phone_allowlist (
  email         text primary key,
  notes         text,
  created_at    timestamptz not null default now()
);

comment on table public.registration_phone_allowlist is
  '与 auth.users.email 匹配（不分大小写、去首尾空格）的帐号注册时写入 phone_binding_exempt=true';

alter table public.registration_phone_allowlist enable row level security;
-- 无对外开放 policy：仅供 security definer 触发器读写；控制台可用 service_role 维护

alter table public.profiles
  add column if not exists phone text,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists phone_binding_exempt boolean not null default false;

comment on column public.profiles.phone is '绑定手机号；唯一；格式与短信网关对齐后再统一校验';
comment on column public.profiles.phone_verified_at is '最近一次短信 OTP 校验通过时间';
comment on column public.profiles.phone_binding_exempt is
  '为 true：产品不要求完成手机号绑定即可使用（常见于研发预留邮箱）';

create unique index if not exists profiles_phone_unique_nn
  on public.profiles (phone)
  where phone is not null;

-- 占位研发邮箱（5 个）：部署前请按需替换为你的真实测试邮箱 -------
insert into public.registration_phone_allowlist (email, notes) values
  ('dev-shijian-1@local.dev', '预留开发帐号 1'),
  ('dev-shijian-2@local.dev', '预留开发帐号 2'),
  ('dev-shijian-3@local.dev', '预留开发帐号 3'),
  ('dev-shijian-4@local.dev', '预留开发帐号 4'),
  ('dev-shijian-5@local.dev', '预留开发帐号 5')
on conflict (email) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm text;
  exempt boolean;
begin
  email_norm := lower(trim(both from coalesce(new.email, '')));
  exempt :=
    email_norm <> ''
    and exists (
      select 1
      from public.registration_phone_allowlist l
      where lower(trim(both from l.email)) = email_norm
    );

  insert into public.profiles (
    id,
    user_code,
    nickname,
    phone_binding_exempt
  )
  values (
    new.id,
    'SJ' || upper(substring(replace(new.id::text, '-', '') from 1 for 6)),
    coalesce(
      nullif(new.raw_user_meta_data->>'nickname', ''),
      '食鉴用户'
    ),
    exempt
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 历史用户：若在 allowlist 中则补标记（便于你已存在的测试帐号对齐策略）
update public.profiles p
set phone_binding_exempt = true
from auth.users u
where p.id = u.id
  and lower(trim(both from coalesce(u.email, ''))) <> ''
  and exists (
    select 1 from public.registration_phone_allowlist l
    where lower(trim(both from l.email))
      = lower(trim(both from coalesce(u.email, '')))
  );
