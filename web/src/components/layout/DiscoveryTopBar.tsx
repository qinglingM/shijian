import type { ReactNode } from 'react'
import { CityPicker } from '@/features/city-picker/CityPicker'
import { cn } from '@/lib/utils'

interface DiscoveryTopBarProps {
  searchSlot: ReactNode
  className?: string
}

export function DiscoveryTopBar({
  searchSlot,
  className,
}: DiscoveryTopBarProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="min-w-0 flex-1">{searchSlot}</div>
      <CityPicker variant="navbar" />
    </div>
  )
}
