import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import type { ProfileRow } from '@/lib/db'
import { maskPhoneDisplay } from '@/lib/maskPhone'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/** 与用户资料 gender 校验一致（空串→存 null） */
const GENDER_SELECT: { value: string; label: string }[] = [
  { value: '', label: '未选择' },
  { value: 'unspecified', label: '未告知' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
  { value: 'prefer_not_say', label: '不愿透露' },
]

/** 与用户资料 zodiac_sign 校验一致 */
const ZODIAC_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '未选择' },
  { value: 'aries', label: '白羊座' },
  { value: 'taurus', label: '金牛座' },
  { value: 'gemini', label: '双子座' },
  { value: 'cancer', label: '巨蟹座' },
  { value: 'leo', label: '狮子座' },
  { value: 'virgo', label: '处女座' },
  { value: 'libra', label: '天秤座' },
  { value: 'scorpio', label: '天蝎座' },
  { value: 'sagittarius', label: '射手座' },
  { value: 'capricorn', label: '摩羯座' },
  { value: 'aquarius', label: '水瓶座' },
  { value: 'pisces', label: '双鱼座' },
]

type EditProfilePick = Pick<
  ProfileRow,
  | 'user_code'
  | 'nickname'
  | 'bio'
  | 'gender'
  | 'zodiac_sign'
  | 'hometown'
  | 'birth_date'
  | 'phone'
  | 'phone_verified_at'
  | 'phone_binding_exempt'
>

const settingsControlRight =
  'w-full min-w-0 bg-transparent py-1 text-right text-sm text-neutral-900 outline-none ring-0 placeholder:text-neutral-400'

function SettingsRow({
  label,
  children,
  alignTop = false,
}: {
  label: string
  children: ReactNode
  alignTop?: boolean
}) {
  return (
    <div
      className={`flex gap-3 px-4 py-3 ${alignTop ? 'items-start' : 'items-center'}`}
    >
      <span className="w-[7rem] shrink-0 text-sm leading-normal text-neutral-500">{label}</span>
      <div data-slot="ctrl" className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  )
}

function SettingsSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  ariaLabel: string
}) {
  return (
    <div className="relative flex justify-end">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`cursor-pointer appearance-none pr-7 ${settingsControlRight}`}
      >
        {options.map((o) => (
          <option key={o.value === '' ? '_empty' : o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 size-[17px] -translate-y-1/2 text-neutral-400"
        strokeWidth={2}
      />
    </div>
  )
}

function pickEditProfile(row: Record<string, unknown>): EditProfilePick {
  const bd = row.birth_date
  let birth_date: string | null = null
  if (bd != null && bd !== '') {
    const s = typeof bd === 'string' ? bd : String(bd)
    birth_date = s.slice(0, 10)
  }
  return {
    user_code: String(row.user_code ?? ''),
    nickname: String(row.nickname ?? ''),
    bio: typeof row.bio === 'string' ? row.bio : null,
    gender: typeof row.gender === 'string' ? row.gender : null,
    zodiac_sign: typeof row.zodiac_sign === 'string' ? row.zodiac_sign : null,
    hometown: typeof row.hometown === 'string' ? row.hometown : null,
    birth_date,
    phone: typeof row.phone === 'string' ? row.phone : null,
    phone_verified_at:
      typeof row.phone_verified_at === 'string' ? row.phone_verified_at : null,
    phone_binding_exempt: row.phone_binding_exempt === true,
  }
}

function MeProfileEditForm({ initial, userId }: { initial: EditProfilePick; userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (payload: {
      nickname: string
      bio: string
      gender: string | null
      zodiac_sign: string | null
      hometown: string | null
      birth_date: string | null
    }) => {
      const supabase = getSupabase()
      const { error } = await supabase
        .from('profiles')
        .update({
          nickname: payload.nickname.trim(),
          bio: payload.bio.trim() || null,
          gender: payload.gender,
          zodiac_sign: payload.zodiac_sign,
          hometown: payload.hometown?.trim() || null,
          birth_date: payload.birth_date || null,
        })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['me-profile-edit'] })
      navigate('/me')
    },
  })

  const [nickname, setNickname] = useState(initial.nickname ?? '')
  const [bio, setBio] = useState(initial.bio ?? '')
  const [gender, setGender] = useState(initial.gender ?? '')
  const [zodiacSign, setZodiacSign] = useState(initial.zodiac_sign ?? '')
  const [hometown, setHometown] = useState(initial.hometown ?? '')
  const [birthDate, setBirthDate] = useState(
    initial.birth_date ? initial.birth_date.slice(0, 10) : '',
  )

  const baselineBirth = initial.birth_date ? initial.birth_date.slice(0, 10) : ''
  const isDirty =
    nickname.trim() !== (initial.nickname ?? '').trim() ||
    bio.trim() !== (initial.bio ?? '').trim() ||
    (gender || null) !== (initial.gender ?? null) ||
    (zodiacSign || null) !== (initial.zodiac_sign ?? null) ||
    hometown.trim() !== (initial.hometown ?? '').trim() ||
    (birthDate.trim() || '') !== baselineBirth

  const nicknameOk = nickname.trim().length > 0
  const canSubmit = isDirty && nicknameOk

  return (
    <form
      className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-5 pb-10"
      onSubmit={(e) => {
        e.preventDefault()
        const n = nickname.trim()
        if (!isDirty || !n) return
        mutation.mutate({
          nickname: n,
          bio,
          gender: gender || null,
          zodiac_sign: zodiacSign || null,
          hometown: hometown.trim() || null,
          birth_date: birthDate.trim() || null,
        })
      }}
    >
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <SettingsRow label="昵称">
          <input
            required
            maxLength={32}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="填写昵称"
            className={settingsControlRight}
          />
        </SettingsRow>

        <SettingsRow label="食鉴号">
          <span
            tabIndex={-1}
            className="block truncate text-right text-sm font-semibold tracking-wide text-neutral-900"
            title={initial.user_code}
          >
            {initial.user_code}
          </span>
        </SettingsRow>

        <SettingsRow label="个性签名" alignTop>
          <div className="flex flex-col items-stretch gap-1">
            <textarea
              rows={2}
              maxLength={200}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="一句话介绍"
              className={`min-h-[3rem] w-full resize-none bg-transparent text-right text-sm text-neutral-900 outline-none placeholder:text-neutral-400`}
            />
            <span className="text-right text-[11px] text-neutral-400">{bio.length}/200</span>
          </div>
        </SettingsRow>

        <SettingsRow label="性别">
          <SettingsSelect
            ariaLabel="性别"
            value={gender}
            onChange={setGender}
            options={GENDER_SELECT}
          />
        </SettingsRow>

        <SettingsRow label="生日">
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            min="1920-01-01"
            className={`${settingsControlRight} [-webkit-appearance:none] [&::-webkit-calendar-picker-indicator]:ml-0 [&::-webkit-calendar-picker-indicator]:opacity-60`}
          />
        </SettingsRow>

        <SettingsRow label="星座">
          <SettingsSelect
            ariaLabel="星座"
            value={zodiacSign}
            onChange={setZodiacSign}
            options={ZODIAC_OPTIONS}
          />
        </SettingsRow>

        <SettingsRow label="家乡">
          <input
            maxLength={128}
            value={hometown}
            onChange={(e) => setHometown(e.target.value)}
            placeholder="省市或籍贯"
            className={settingsControlRight}
          />
        </SettingsRow>

        <SettingsRow label="绑定手机号">
          <span
            className="block truncate text-right text-sm text-neutral-800"
            title={
              initial.phone
                ? `${maskPhoneDisplay(initial.phone)}${initial.phone_verified_at ? '（已验证）' : ''}`
                : initial.phone_binding_exempt
                  ? '研发预留帐号，暂不强制绑定'
                  : '尚未绑定'
            }
          >
            {initial.phone
              ? `${maskPhoneDisplay(initial.phone)}${initial.phone_verified_at ? '' : '（待验证）'}`
              : initial.phone_binding_exempt
                ? '无需绑定'
                : '尚未绑定'}
          </span>
        </SettingsRow>
      </div>

      {mutation.isError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
          保存失败，请检查网络或稍后重试。
        </p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending || !canSubmit}
        className={
          mutation.isPending
            ? 'mt-1 w-full cursor-wait rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-sm font-medium text-white opacity-85 shadow-md shadow-orange-700/20'
            : canSubmit
              ? 'mt-1 w-full rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-sm font-medium text-white shadow-md shadow-orange-700/20 active:opacity-95'
              : 'mt-1 w-full cursor-default rounded-2xl bg-neutral-200 py-3.5 text-sm font-medium text-neutral-500'
        }
      >
        {mutation.isPending ? '保存中…' : isDirty ? (nicknameOk ? '保存更改' : '昵称不能为空') : '无更改'}
      </button>
    </form>
  )
}

export function MeProfileEditPage() {
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const profileQuery = useQuery({
    queryKey: ['me-profile-edit', userId],
    enabled: Boolean(isSupabaseConfigured && userId),
    queryFn: async (): Promise<EditProfilePick | null> => {
      const supabase = getSupabase()
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle()
      if (error) throw error
      if (!data) return null
      return pickEditProfile(data as Record<string, unknown>)
    },
  })

  if (!isSupabaseConfigured) {
    return (
      <>
        <BackHeader title="编辑资料" backTo="/me" />
        <p className="px-5 py-8 text-sm text-neutral-500">配置 Supabase 后可编辑资料。</p>
      </>
    )
  }

  if (!userId) {
    return (
      <>
        <BackHeader title="编辑资料" backTo="/me" />
        <p className="px-5 py-8 text-sm text-neutral-500">请先登录。</p>
      </>
    )
  }

  if (profileQuery.isPending) {
    return (
      <>
        <BackHeader title="编辑资料" backTo="/me" />
        <p className="px-5 py-10 text-center text-sm text-neutral-400">载入资料…</p>
      </>
    )
  }

  if (profileQuery.isError) {
    const err = profileQuery.error
    const detail =
      err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : null
    return (
      <>
        <BackHeader title="编辑资料" backTo="/me" />
        <div className="space-y-2 px-5 py-8">
          <p className="text-sm text-red-600">载入失败，请稍后重试。</p>
          {detail ? (
            <p className="text-xs leading-relaxed text-neutral-500 [word-break:break-word]">{detail}</p>
          ) : null}
        </div>
      </>
    )
  }

  const row = profileQuery.data
  if (!row) {
    return (
      <>
        <BackHeader title="编辑资料" backTo="/me" />
        <p className="px-5 py-8 text-sm text-neutral-500">未找到账号资料。</p>
      </>
    )
  }

  return (
    <>
      <BackHeader title="编辑资料" backTo="/me" />
      <MeProfileEditForm initial={row} userId={userId} />
    </>
  )
}
