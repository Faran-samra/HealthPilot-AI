import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Baby,
  Bug,
  Heart,
  HeartPulse,
  Users,
  Wallet,
} from 'lucide-react'
import type { WhoPakistanKpi } from '@/types/whoStats'
import { formatPopulation, simplifyWhoNumber } from '@/lib/whoStatsDisplay'
import { cn } from '@/lib/utils'

const KPI_ICONS: Record<string, LucideIcon> = {
  life_expectancy: Heart,
  population: Users,
  health_expenditure_gdp: Wallet,
  maternal_mortality: HeartPulse,
  under_five_mortality: Baby,
  tb_incidence: Activity,
  malaria_incidence: Bug,
  ncd_premature_risk: HeartPulse,
}

const CARD_ACCENTS: Record<string, string> = {
  life_expectancy: 'from-rose-500/10 to-card',
  population: 'from-sky-500/10 to-card',
  maternal_mortality: 'from-pink-500/10 to-card',
  under_five_mortality: 'from-amber-500/10 to-card',
  tb_incidence: 'from-orange-500/10 to-card',
  malaria_incidence: 'from-green-500/10 to-card',
  ncd_premature_risk: 'from-violet-500/10 to-card',
  health_expenditure_gdp: 'from-teal-500/10 to-card',
}

interface Props {
  kpis: WhoPakistanKpi[]
}

export function WhoStatsInsightCards({ kpis }: Props) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {kpis.map((kpi, index) => {
        const Icon = KPI_ICONS[kpi.key] ?? Activity
        const simple =
          kpi.key === 'population'
            ? formatPopulation(kpi.value)
            : simplifyWhoNumber(kpi.displayValue, kpi.value)
        const accent = CARD_ACCENTS[kpi.key] ?? 'from-primary/10 to-card'

        return (
          <article
            key={kpi.key}
            className={cn(
              'group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-5 shadow-sm transition-shadow hover:shadow-md',
              accent,
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm">
                <Icon className="size-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold leading-snug text-foreground">
                  {t(`whoStats.kpi.${kpi.key}.title`, { defaultValue: kpi.label })}
                </h3>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-primary">
                  {simple}
                  {kpi.key === 'life_expectancy' && (
                    <span className="ml-1 text-base font-medium text-muted-foreground">
                      {t('whoStats.years')}
                    </span>
                  )}
                  {kpi.key === 'health_expenditure_gdp' && (
                    <span className="ml-0.5 text-base font-medium text-muted-foreground">%</span>
                  )}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t(`whoStats.kpi.${kpi.key}.explain`, { value: simple, year: kpi.year })}
            </p>
          </article>
        )
      })}
    </div>
  )
}
