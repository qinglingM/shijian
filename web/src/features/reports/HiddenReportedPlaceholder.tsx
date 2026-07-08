export function HiddenReportedPlaceholder({
  className = '',
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  return (
    <div className={`rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 text-center text-neutral-500 ${compact ? 'py-4 text-xs' : 'py-8 text-sm'} ${className}`}>
      已收到举报并隐藏该内容
    </div>
  )
}
