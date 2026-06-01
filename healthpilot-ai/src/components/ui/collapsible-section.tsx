import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  icon?: React.ReactNode
  defaultOpen?: boolean
  variant?: 'default' | 'warning' | 'danger'
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  variant = 'default',
  children,
}: CollapsibleSectionProps) {
  const borderClass =
    variant === 'danger'
      ? 'border-red-200 bg-red-50'
      : variant === 'warning'
        ? 'border-orange-200 bg-orange-50'
        : 'border-border bg-card'

  return (
    <details
      open={defaultOpen}
      className={cn('group rounded-xl border', borderClass)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-3 text-sm">{children}</div>
    </details>
  )
}
