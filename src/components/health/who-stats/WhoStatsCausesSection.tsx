import { useTranslation } from 'react-i18next'
import type { WhoPakistanCause } from '@/types/whoStats'
import { CAUSE_CHART_COLORS, causeSharePercent } from '@/lib/whoStatsDisplay'

interface Props {
  causes: WhoPakistanCause[]
}

export function WhoStatsCausesSection({ causes }: Props) {
  const { t } = useTranslation()
  const top = causes.slice(0, 5)
  const shares = causeSharePercent(top)

  const segments = top.map((c, i) => ({
    key: c.key,
    label: t(`whoStats.cause.${c.key}`, { defaultValue: c.label }),
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

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start">
      <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div
          className="relative size-52 rounded-full shadow-inner ring-4 ring-background"
          style={{ background: segments.length ? gradient : 'hsl(var(--muted))' }}
          role="img"
          aria-label={t('whoStats.chartDonutTitle')}
        >
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-card text-center shadow-sm">
            <span className="text-3xl">🇵🇰</span>
            <span className="mt-1 text-xs font-medium text-muted-foreground">
              {t('whoStats.chartCauses')}
            </span>
          </div>
        </div>
        <ul className="mt-6 w-full space-y-2">
          {segments.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CAUSE_CHART_COLORS[i] }}
              />
              <span className="flex-1 truncate">{s.label}</span>
              <span className="font-semibold tabular-nums text-primary">{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {segments.map((s, i) => (
          <div
            key={s.key}
            className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-colors hover:border-primary/20"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{s.label}</p>
                {s.tip && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.tip}</p>
                )}
                {i === 0 && (
                  <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {t('whoStats.rankMostCommon')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
