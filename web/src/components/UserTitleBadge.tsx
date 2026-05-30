export function UserTitleBadge({ name }: { name: string | null | undefined }) {
  if (!name) return null
  return (
    <span className="ml-1 inline-flex items-center rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 px-1.5 py-[1px] text-[8px] font-semibold text-white leading-normal align-middle">
      {name}
    </span>
  )
}
