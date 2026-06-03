import { useTranslation } from 'react-i18next'
import { TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { WhoPakistanCause } from '@/types/whoStats'
import { CAUSE_CHART_COLORS, causeSharePercent } from '@/lib/whoStatsDisplay'
import { cn } from '@/lib/utils'

interface Props {
  causes: WhoPakistanCause[]
  sourceYear?: number
}

export function WhoStatsCausesSection({ causes, sourceYear = 2021 }: Props) {
  const { t } = useTranslation()
  const top = causes.slice(0, 5)
  const shares = causeSharePercent(top)

  const segments = top.map((c, i) => ({
    key: c.key,
    label: t(`whoStats.cause.${c.key}`, { defaultValue: c.label }),
    rate: c.deathsPer100k,
    pct: shares.get(c.key) ?? 0,
    color: CAUSE_CHART_COLORS[i % CAUSE_CHART_COLORS.length],
    tip: t(`whoStats.causeTip.${c.key}`, { defaultValue: '' }),
  }))

  let gradient = 'conic-gradient('
  let acc = 0
  segments.forEach((s, i) => {
    const start = acc
    acc += s.pct
    gradient += `${s.color} ${start}% ${acc}%`
    if (i < segments.length - 1) gradient += ', '
  })
  gradient += ')'

  const maxPct = Math.max(...segments.map((s) => s.pct), 1)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          <TrendingUp className="size-4 shrink-0 text-primary" />
          <span>{t('whoStats.chartDonutDesc')}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {t('whoStats.causesYearBadge', { year: sourceYear })}
        </Badge>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start">
        <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <p className="mb-3 w-full text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('whoStats.chartDonutTitle')}
          </p>
          <div
            className="relative size-48 rounded-full shadow-inner ring-4 ring-background"
            style={{ background: segments.length ? gradient : 'hsl(var(--muted))' }}
            role="img"
            aria-label={t('whoStats.chartDonutTitle')}
          >
            <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-card px-2 text-center shadow-sm">
              <span className="text-xl leading-none" aria-hidden>
                🇵🇰
              </span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
                {t('whoStats.chartCenterCountry')}
              </span>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
            {t('whoStats.chartShareNote')}
          </p>
          <ul className="mt-4 w-full space-y-2">
            {segments.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2 text-xs sm:text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CAUSE_CHART_COLORS[i] }}
                />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-primary">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5">
          {segments.map((s, i) => (
            <article
              key={s.key}
              className={cn(
                'rounded-xl border border-border/50 bg-card p-3.5 shadow-sm sm:p-4',
                i === 0 && 'border-primary/20 ring-1 ring-primary/10',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    i === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{s.label}</p>
                    {i === 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {t('whoStats.rankMostCommon')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('whoStats.causeRate', { rate: s.rate, year: sourceYear })}
                  </p>
                  {s.tip && (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.tip}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(s.pct / maxPct) * 100}%`,
                          backgroundColor: CAUSE_CHART_COLORS[i],
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {t('whoStats.causeShareLabel', { pct: s.pct })}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
