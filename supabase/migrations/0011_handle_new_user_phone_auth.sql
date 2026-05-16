-- ====================================================================
-- 0011 · 手机号注册兼容：profiles 填入 auth.phone + 修正 handle_new_user
-- ====================================================================
-- 在用户仅通过手机号 OTP 落地（auth.users.phone 非空且 email 常为空）时也创建 profile，
-- 并同步 profiles.phone（与 JWT 校验身份一致）。
-- ====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm      text;
  phone_trim      text;
  exempt          boolean;
  nick            text;
  verified_at     timestamptz;
begin
  email_norm :=
    lower(trim(both from coalesce(new.email, '')));
  phone_trim :=
    nullif(trim(both from coalesce(new.phone, '')), '');

  exempt :=
    email_norm <> ''
    and exists (
      select 1 from public.registration_phone_allowlist l
      where lower(trim(both from l.email)) = email_norm
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

-- 历史：Auth 仅有手机号的帐号补 profiles.phone（未跑过 INSERT 的行理论上不应有，容错用）
update public.profiles p
set
  phone = coalesce(nullif(trim(both u.phone), ''), p.phone),
  phone_verified_at = coalesce(p.phone_verified_at, u.phone_confirmed_at)
from auth.users u
where p.id = u.id
  and trim(both from coalesce(u.phone::text, '')) <> ''
  and (p.phone is null or (p.phone_verified_at is null and u.phone_confirmed_at is not null));
