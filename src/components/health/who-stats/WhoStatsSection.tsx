import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  eyebrow?: string
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  variant?: 'default' | 'muted' | 'accent'
}

export function WhoStatsSection({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
  variant = 'default',
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-20 py-10 md:py-12 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both',
        variant === 'muted' && 'rounded-3xl bg-muted/40 px-4 md:px-8',
        variant === 'accent' &&
          'rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/8 via-background to-background px-4 md:px-8',
        className,
      )}
    >
      <header className="mb-8 max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        {subtitle && (
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  )
}
