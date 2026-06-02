import { useTranslation } from 'react-i18next'
import { Heart, Users } from 'lucide-react'
import type { WhoPakistanKpi } from '@/types/whoStats'
import { formatPopulation, simplifyWhoNumber } from '@/lib/whoStatsDisplay'

interface Props {
  life?: WhoPakistanKpi
  population?: WhoPakistanKpi
}

export function WhoStatsHighlights({ life, population }: Props) {
  const { t } = useTranslation()

  if (!life && !population) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {life && (
        <div className="relative overflow-hidden rounded-3xl border border-rose-200/50 bg-gradient-to-br from-rose-50 to-card p-6 shadow-sm dark:border-rose-900/30 dark:from-rose-950/30">
          <Heart className="absolute -right-2 -top-2 size-24 text-rose-500/10" />
          <p className="text-sm font-medium text-rose-800/80 dark:text-rose-200/80">
            {t('whoStats.highlightLifeLabel')}
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums text-foreground md:text-5xl">
            {simplifyWhoNumber(life.displayValue, life.value)}
            <span className="ml-2 text-xl font-semibold text-muted-foreground">
              {t('whoStats.years')}
            </span>
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t('whoStats.highlightLifeNote', { year: life.year })}
          </p>
        </div>
      )}
      {population && (
        <div className="relative overflow-hidden rounded-3xl border border-sky-200/50 bg-gradient-to-br from-sky-50 to-card p-6 shadow-sm dark:border-sky-900/30 dark:from-sky-950/30">
          <Users className="absolute -right-2 -top-2 size-24 text-sky-500/10" />
          <p className="text-sm font-medium text-sky-800/80 dark:text-sky-200/80">
            {t('whoStats.highlightPopLabel')}
          </p>
          <p className="mt-2 text-4xl font-bold text-foreground md:text-5xl">
            {formatPopulation(population.value)}
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t('whoStats.highlightPopNote', { year: population.year })}
          </p>
        </div>
      )}
    </div>
  )
}
