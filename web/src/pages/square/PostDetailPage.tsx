import { Link } from 'react-router-dom'
import { BackHeader } from '@/components/layout/AppLayout'

export function PostDetailPage() {
  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-white">
      <BackHeader title="帖子详情" backTo="/square" />
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-neutral-500">帖子功能已下线，广场仅展示食鉴内容。</p>
          <Link to="/square" className="mt-4 inline-block text-sm font-semibold text-orange-600">回到广场</Link>
        </div>
      </div>
    </div>
  )
}
