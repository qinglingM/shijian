import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { BackHeader } from '@/components/layout/AppLayout'
import { readImageAsDataUrl } from '@/lib/imageFile'
import { checkTexts } from '@/lib/moderation/engine'
import { useCreatePostMutation } from '@/features/posts/useCreatePostMutation'
import { usePracticeDraft } from '@/stores/practiceDraft'

export function SquarePublishPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'practice' | 'article' | null>(null)

  if (!mode) {
    return (
      <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
        <BackHeader title="发布" backTo="/square" />
        <div className="flex flex-1 flex-col justify-end px-4 pb-6">
          <div className="rounded-3xl bg-white p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] ring-1 ring-neutral-100">
            <p className="text-center text-sm font-semibold text-neutral-900">选择发布类型</p>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setMode('practice')}
                className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 px-4 py-4 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-neutral-900">发食鉴</span>
                  <span className="block text-xs text-neutral-500">选店、写一句锐评，发布后进广场</span>
                </span>
                <ArrowLeft size={16} className="rotate-180 text-neutral-400" />
              </button>
              <button
                type="button"
                onClick={() => setMode('article')}
                className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 px-4 py-4 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-neutral-900">发帖子</span>
                  <span className="block text-xs text-neutral-500">上传首图，填标题和内容</span>
                </span>
                <ArrowLeft size={16} className="rotate-180 text-neutral-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return mode === 'practice' ? <PracticePublishForm /> : <ArticlePublishForm onBack={() => setMode(null)} navigate={navigate} />
}

function PracticePublishForm() {
  const navigate = useNavigate()
  const draft = usePracticeDraft()

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
      <BackHeader title="发食鉴" backTo="/square" />
      <div className="px-4 pt-4 pb-6">
        <div className="rounded-3xl border border-orange-100 bg-orange-50 px-4 py-4 text-sm text-neutral-700">
          直接沿用现有食鉴流程，提交后会自动进入广场双列流。
        </div>
        <button
          type="button"
          onClick={() => navigate('/practice/step1')}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-sm font-medium text-white"
        >
          去选择店铺开始食鉴
        </button>
        <button
          type="button"
          onClick={() => draft.reset()}
          className="mt-3 flex w-full items-center justify-center rounded-2xl border border-neutral-200 py-3.5 text-sm font-medium text-neutral-700"
        >
          清空当前草稿
        </button>
      </div>
    </div>
  )
}

function ArticlePublishForm({ onBack, navigate }: { onBack: () => void; navigate: ReturnType<typeof useNavigate> }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishWarning, setPublishWarning] = useState<string | null>(null)
  const createPost = useCreatePostMutation()

  async function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverImageUrl(await readImageAsDataUrl(file))
    e.target.value = ''
  }

  async function handleSubmit() {
    const t = title.trim()
    const c = content.trim()
    if (!t || !c) return

    setPublishError(null)
    setPublishWarning(null)

    const modResult = checkTexts([t, c])
    if (modResult.blocked) {
      setPublishError(modResult.message)
      return
    }
    setPublishWarning(modResult.message)

    const created = await createPost.mutateAsync({
      title: t,
      content: c,
      cover_image_url: coverImageUrl,
      post_type: 'article',
    })
    navigate(`/square`, { replace: true })
    void created
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
      <BackHeader title="发帖子" backTo="/square" />
      <div className="px-4 pt-4 pb-6">
        <label className="block rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-center">
          <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="封面预览" className="h-48 w-full rounded-2xl object-cover" />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl bg-white text-neutral-400">
              <Camera size={28} />
            </div>
          )}
          <p className="mt-3 text-sm text-neutral-600">点击上传首图</p>
        </label>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className="mt-4 w-full rounded-2xl bg-neutral-100 px-4 py-3 text-sm outline-none"
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="内容"
          rows={7}
          className="mt-3 w-full rounded-2xl bg-neutral-100 px-4 py-3 text-sm outline-none"
        />

        {publishError && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-center text-xs leading-5 text-rose-600">
            {publishError}
          </p>
        )}
        {!publishError && publishWarning && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs leading-5 text-amber-700">
            {publishWarning}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={createPost.isPending || !title.trim() || !content.trim()}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 py-3.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {createPost.isPending ? '发布中…' : '发布帖子'}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="mt-3 flex w-full items-center justify-center rounded-2xl border border-neutral-200 py-3.5 text-sm font-medium text-neutral-700"
        >
          返回选择
        </button>
      </div>
    </div>
  )
}
