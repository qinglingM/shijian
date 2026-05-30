const RARITY_GRADIENTS: Record<string, string> = {
  legendary: 'from-amber-800 to-yellow-600',
  epic: 'from-indigo-400 to-purple-500',
  rare: 'from-sky-400 to-blue-500',
  common: 'from-emerald-400 to-green-500',
}

export function UserTitleBadge({ name, rarity }: { name: string | null | undefined; rarity?: string | null }) {
  if (!name) return null
  const gradient = RARITY_GRADIENTS[rarity ?? ''] ?? 'from-neutral-400 to-neutral-500'
  return (
    <span className={`ml-1 inline-flex items-center rounded-full bg-gradient-to-r ${gradient} px-1.5 py-[1px] text-[8px] font-semibold text-white leading-normal align-middle`}>
      {name}
    </span>
  )
}
