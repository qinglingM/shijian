-- 0013 · profiles 性别 / 星座 / 家乡文案 / 生日（食鉴号仍为 user_code，仅展示不可改）

alter table public.profiles
  add column if not exists gender text
    check (
      gender is null
      or gender in ('unspecified', 'male', 'female', 'other', 'prefer_not_say')
    ),
  add column if not exists zodiac_sign text
    check (
      zodiac_sign is null
      or zodiac_sign in (
        'aries',
        'taurus',
        'gemini',
        'cancer',
        'leo',
        'virgo',
        'libra',
        'scorpio',
        'sagittarius',
        'capricorn',
        'aquarius',
        'pisces'
      )
    ),
  add column if not exists hometown text
    check (hometown is null or char_length(trim(hometown)) <= 128),
  add column if not exists birth_date date;

comment on column public.profiles.gender is '性别（unspecified=未告知）';
comment on column public.profiles.zodiac_sign is '星座：黄道十二宫英文代号';
comment on column public.profiles.hometown is '家乡（简短文案）';
comment on column public.profiles.birth_date is '生日';
