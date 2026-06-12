import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'
import { renderMarkdown } from '@/lib/markdown'

const DOC_TITLES: Record<string, string> = {
  terms: '用户协议',
  privacy: '隐私政策',
}

export function LegalDocPage() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const key = slug === 'privacy' ? 'privacy' : 'terms'
  const title = DOC_TITLES[key]

  const [content, setContent] = useState<string>('正在加载文档...')

  useEffect(() => {
    fetch(`/docs/${key}.md`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch document')
        return res.text()
      })
      .then((text) => setContent(text))
      .catch(() => setContent('无法加载文档，请检查网络连接或相关文档是否存在。'))
  }, [key])

  return (
    <div className="min-h-full bg-white">
      <BackHeader title={title} onBack={() => navigate(-1)} />
      <article className="px-5 py-6">
        <div className="text-[14px] leading-7 text-neutral-700 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:mt-8 [&>h1]:text-neutral-900 [&>h2]:text-[17px] [&>h2]:font-bold [&>h2]:mb-4 [&>h2]:mt-8 [&>h2]:text-neutral-900 [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>ul>li]:mb-2 [&>strong]:font-semibold [&>strong]:text-neutral-900">
          {renderMarkdown(content)}
        </div>
      </article>
    </div>
  )
}
