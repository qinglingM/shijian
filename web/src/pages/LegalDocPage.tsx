import { Link, useParams } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'

const BODY: Record<'terms' | 'privacy', { title: string; body: string }> = {
  terms: {
    title: '用户协议',
    body: '《用户协议》正文待产品与法务审定后在此处发布。当前占位版本不影响你在食鉴中使用基础功能。',
  },
  privacy: {
    title: '隐私政策',
    body: '《隐私政策》正文待产品与法务审定后在此处发布。我们仅在实现账号与安全所必需的范围内处理你的信息。',
  },
}

export function LegalDocPage() {
  const { slug } = useParams()
  const key = slug === 'privacy' ? 'privacy' : 'terms'
  const doc = BODY[key]

  return (
    <div className="min-h-full bg-white">
      <BackHeader title={doc.title} backTo="/auth" />
      <article className="px-5 py-6 text-sm leading-7 text-neutral-700">
        <p>{doc.body}</p>
        <Link to="/auth" className="mt-8 inline-block text-sm font-medium text-orange-700">
          返回登录
        </Link>
      </article>
    </div>
  )
}
