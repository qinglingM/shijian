import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronDown } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { ImageCropDialog } from '@/components/image/ImageCropDialog'
import type { ProfileRow } from '@/lib/db'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useProfilePrivacyMutation } from '@/features/profile/useProfilePrivacyMutation'
import { useCities } from '@/features/city-picker/useCities'

/** 与用户资料 gender 校验一致（空串→存 null） */
const GENDER_SELECT: { value: string; label: string }[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
  { value: '', label: '不展示' },
]

/** 与用户资料 zodiac_sign 校验一致 */
const ZODIAC_OPTIONS: { value: string; label: string }[] = [
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
  | 'avatar_url'
  | 'is_profile_public'
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
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    is_profile_public: row.is_profile_public !== false,
  }
}

function HometownPicker({ value, onChange, provinces }: { value: string; onChange: (v: string) => void; provinces: [string, string[]][] }) {
  const [open, setOpen] = useState(false)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const citiesInProvince = selectedProvince
    ? provinces.find(([p]) => p === selectedProvince)?.[1] ?? []
    : []
  return (
    <>
      <button
        type="button"
        onClick={() => { setSelectedProvince(null); setOpen(true) }}
        className={`ml-auto flex items-center gap-1 text-sm transition-colors ${
          value ? 'text-neutral-900' : 'text-neutral-400'
        }`}
      >
        <span>{value || '省市'}</span>
        <ChevronDown size={14} className="text-neutral-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-40 cursor-default bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto mx-4 w-full max-w-[18rem] rounded-2xl bg-white shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <p className="text-[15px] font-semibold text-neutral-900">
                  {selectedProvince || '选择省份'}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full px-2 py-1 text-sm text-orange-700 active:bg-orange-50"
                >
                  关闭
                </button>
              </div>
              <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: '50dvh' }}>
                {!selectedProvince ? (
                  <div className="flex flex-wrap gap-2">
                    {provinces.map(([pname]) => (
                      <button
                        key={pname}
                        type="button"
                        onClick={() => setSelectedProvince(pname)}
                        className="rounded-xl bg-neutral-100 px-4 py-2.5 text-[13px] font-medium text-neutral-700 active:bg-neutral-200"
                      >
                        {pname}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {citiesInProvince.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { onChange(name); setOpen(false) }}
                        className={`rounded-xl px-4 py-2.5 text-[13px] font-medium transition-colors ${
                          value === name
                            ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                            : 'bg-neutral-100 text-neutral-700 active:bg-neutral-200'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function GenderPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = GENDER_SELECT.find((o) => o.value === value)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`ml-auto flex items-center gap-1 text-sm transition-colors ${
          value ? 'text-neutral-900' : 'text-neutral-400'
        }`}
      >
        <span>{current?.label ?? '不展示'}</span>
        <ChevronDown size={14} className="text-neutral-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-40 cursor-default bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto mx-4 w-full max-w-[18rem] rounded-2xl bg-white shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <p className="text-[15px] font-semibold text-neutral-900">选择性别</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full px-2 py-1 text-sm text-orange-700 active:bg-orange-50"
                >
                  关闭
                </button>
              </div>
              <div className="px-4 py-4">
                <div className="flex gap-2">
                  {GENDER_SELECT.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { onChange(opt.value); setOpen(false) }}
                      className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                        value === opt.value
                          ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                          : 'bg-neutral-100 text-neutral-700 active:bg-neutral-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function ZodiacPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const current = ZODIAC_OPTIONS.find((o) => o.value === value)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`ml-auto flex items-center gap-1 text-sm transition-colors ${
          value ? 'text-neutral-900' : 'text-neutral-400'
        }`}
      >
        <span>{current?.label ?? '选择星座'}</span>
        <ChevronDown size={14} className="text-neutral-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-40 cursor-default bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto mx-4 w-full max-w-[20rem] rounded-2xl bg-white shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <p className="text-[15px] font-semibold text-neutral-900">选择星座</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full px-2 py-1 text-sm text-orange-700 active:bg-orange-50"
                >
                  关闭
                </button>
              </div>
              <div className="overflow-y-auto px-4 py-4">
                <div className="grid grid-cols-3 gap-2">
                  {ZODIAC_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { onChange(opt.value); setOpen(false) }}
                      className={`rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                        value === opt.value
                          ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                          : 'bg-neutral-100 text-neutral-700 active:bg-neutral-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function AvatarUpload({
  avatarUrl,
  userId,
  onUploaded,
}: {
  avatarUrl: string | null
  userId: string
  onUploaded: (url: string) => void
}) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('请选择图片文件'); return }
    setError(null)
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    setCropSourceUrl(URL.createObjectURL(file))
  }

  function closeCropDialog() {
    if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl)
    setCropSourceUrl(null)
  }

  async function uploadCroppedAvatar(blob: Blob) {
    setError(null)
    setUploading(true)
    const previewUrl = URL.createObjectURL(blob)
    setPreview(previewUrl)
    try {
      const file = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' })
      const path = `${userId}/avatar.jpg`
      const sb = getSupabase()
      const { error: upErr } = await sb.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path)
      const bust = `${publicUrl}?t=${Date.now()}`
      const { error: dbErr } = await sb.from('profiles').update({ avatar_url: bust }).eq('id', userId)
      if (dbErr) throw dbErr
      onUploaded(bust)
      await queryClient.invalidateQueries({ queryKey: ['me-summary'] })
      await queryClient.invalidateQueries({ queryKey: ['me-profile-edit'] })
      closeCropDialog()
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败，请重试')
      setPreview(null)
      throw e
    } finally {
      setUploading(false)
    }
  }

  const displayed = preview ?? avatarUrl

  return (
    <div className="flex flex-col items-center gap-2 py-5">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="relative"
        aria-label="更换头像"
      >
        <div className="w-20 h-20 rounded-full overflow-hidden bg-orange-100 flex items-center justify-center ring-2 ring-orange-200">
          {displayed ? (
            <img src={displayed} alt="头像" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-orange-400">食</span>
          )}
        </div>
        <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-neutral-900 flex items-center justify-center ring-2 ring-white">
          {uploading
            ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Camera size={12} className="text-white" />
          }
        </div>
      </button>
      <p className="text-xs text-neutral-400">{uploading ? '上传中…' : '点击更换头像'}</p>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <ImageCropDialog
        open={!!cropSourceUrl}
        imageUrl={cropSourceUrl}
        title="调整头像"
        cropShape="round"
        outputSize={512}
        onCancel={closeCropDialog}
        onConfirm={uploadCroppedAvatar}
      />
    </div>
  )
}

function MeProfileEditForm({ initial, userId }: { initial: EditProfilePick; userId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url)
  const privacyMut = useProfilePrivacyMutation(userId)
  const [errorText, setErrorText] = useState<string | null>(null)

  const { data: allCities = [] } = useCities()
  const provinces = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const c of allCities) {
      const p = c.province_name?.trim() || '其他'
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(c.name)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
  }, [allCities])

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
    onError: (err) => {
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : String(err)
      setErrorText(message)
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
  const [profilePublic, setProfilePublic] = useState<boolean>(initial.is_profile_public)

  const baselineBirth = initial.birth_date ? initial.birth_date.slice(0, 10) : ''
  const isDirty =
    nickname.trim() !== (initial.nickname ?? '').trim() ||
    bio.trim() !== (initial.bio ?? '').trim() ||
    (gender || null) !== (initial.gender ?? null) ||
    (zodiacSign || null) !== (initial.zodiac_sign ?? null) ||
    hometown.trim() !== (initial.hometown ?? '').trim() ||
    (birthDate.trim() || '') !== baselineBirth ||
    profilePublic !== initial.is_profile_public ||
    avatarUrl !== initial.avatar_url

  const nicknameOk = nickname.trim().length > 0
  const canSubmit = isDirty && nicknameOk

  return (
    <form
      className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-lg flex-col gap-4 px-4 py-5 pb-24"
      onSubmit={(e) => {
        e.preventDefault()
        const n = nickname.trim()
        if (!isDirty || !n) return
        setErrorText(null)
        mutation.mutate({
          nickname: n,
          bio,
          gender: gender || null,
          zodiac_sign: zodiacSign || null,
          hometown: hometown.trim() || null,
          birth_date: birthDate.trim() || null,
        })
        void privacyMut.mutateAsync(profilePublic)
      }}
    >
      <AvatarUpload avatarUrl={avatarUrl} userId={userId} onUploaded={setAvatarUrl} />

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
          <GenderPicker value={gender} onChange={setGender} />
        </SettingsRow>

        <SettingsRow label="生日">
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            min="1920-01-01"
            lang="zh-CN"
            className={`${settingsControlRight} ml-auto w-auto [-webkit-appearance:none] [&::-webkit-calendar-picker-indicator]:hidden`}
          />
        </SettingsRow>

        <SettingsRow label="星座">
          <ZodiacPicker value={zodiacSign} onChange={setZodiacSign} />
        </SettingsRow>

        <SettingsRow label="城市">
          <HometownPicker value={hometown} onChange={setHometown} provinces={provinces} />
        </SettingsRow>

        <SettingsRow label="主页公开">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setProfilePublic((v) => !v)}
              className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${profilePublic ? 'bg-orange-500' : 'bg-neutral-300'}`}
              aria-pressed={profilePublic}
            >
              <span
                className={`size-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${profilePublic ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </SettingsRow>
      </div>

      {errorText ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
          保存失败：{errorText}
        </p>
      ) : null}
      <div className="mt-auto pb-4">
        <button
          type="submit"
          disabled={mutation.isPending || !canSubmit}
          className={
            mutation.isPending
              ? 'w-full cursor-wait rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-sm font-medium text-white opacity-85 shadow-md shadow-orange-700/20'
              : canSubmit
                ? 'w-full rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-sm font-medium text-white shadow-md shadow-orange-700/20 active:opacity-95'
                : 'w-full cursor-default rounded-2xl bg-neutral-200 py-3.5 text-sm font-medium text-neutral-500'
          }
          >
          {mutation.isPending ? '保存中…' : isDirty ? (nicknameOk ? '保存更改' : '昵称不能为空') : '无更改'}
        </button>
      </div>
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
