-- ====================================================================
-- 0012 · 手机号绑定豁免白名单（与邮箱白名单并行）
-- ====================================================================
-- 存入 E.164 格式；匹配时比对「仅数字」避免因 +86 / 空格 差异漏匹配。
-- 命中时 profiles.phone_binding_exempt = true（产品与 Edge 可自行解读）。
-- ====================================================================

create table if not exists public.phone_binding_exempt_mobiles (
  phone_e164 text primary key,
  notes      text,
  created_at timestamptz not null default now()
);

comment on table public.phone_binding_exempt_mobiles is
  '研发/运营放行号码：auth.users.phone 与条目数字串一致则注册时 phone_binding_exempt=true';

alter table public.phone_binding_exempt_mobiles enable row level security;

insert into public.phone_binding_exempt_mobiles (phone_e164, notes) values
  ('+8613718550959', '用户指定白名单手机')
on conflict (phone_e164) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm    text;
  phone_trim    text;
  exempt        boolean;
  nick          text;
  verified_at   timestamptz;
  new_phone_dig text;
begin
  email_norm :=
    lower(trim(both from coalesce(new.email, '')));
  phone_trim :=
    nullif(trim(both from coalesce(new.phone, '')), '');

  new_phone_dig :=
    regexp_replace(coalesce(new.phone::text, ''), '[^0-9]', '', 'g');

  exempt :=
    (
      email_norm <> ''
      and exists (
        select 1 from public.registration_phone_allowlist l
        where lower(trim(both from l.email)) = email_norm
      )
    )
    or (
      new_phone_dig <> ''
      and exists (
        select 1 from public.phone_binding_exempt_mobiles m
        where regexp_replace(trim(both from m.phone_e164), '[^0-9]', '', 'g') = new_phone_dig
      )
    );

  verified_at := new.phone_confirmed_at;

  nick := coalesce(
    nullif(trim(both from new.raw_user_meta_data ->> 'nickname'), ''),
    case
      when length(
        regexp_replace(
          coalesce(new.phone::text, ''),
          '[^0-9]',
          '',
          'g'
        )
      ) >= 4
      then '食友'
        || right(
          regexp_replace(coalesce(new.phone::text, ''), '[^0-9]', '', 'g'),
          4
        )
      else '食鉴用户'
    end
  );

  insert into public.profiles (
    id,
    user_code,
    nickname,
    phone_binding_exempt,
    phone,
    phone_verified_at
  )
  values (
    new.id,
    'SJ'
      || upper(
        substring(
          replace(new.id::text, '-', '') from 1 for 6
        )
      ),
    nick,
    exempt,
    phone_trim,
    verified_at
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 已为该手机号建过帐号时补打标
update public.profiles p
set phone_binding_exempt = true
from auth.users u
where p.id = u.id
  and regexp_replace(coalesce(u.phone::text, ''), '[^0-9]', '', 'g')
  = regexp_replace('+8613718550959', '[^0-9]', '', 'g');
