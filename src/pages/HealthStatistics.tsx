import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { WhoStatsActionBanner } from '@/components/health/who-stats/WhoStatsActionBanner'
import { WhoStatsCausesSection } from '@/components/health/who-stats/WhoStatsCausesSection'
import { WhoStatsHero } from '@/components/health/who-stats/WhoStatsHero'
import { WhoStatsHighlights } from '@/components/health/who-stats/WhoStatsHighlights'
import { WhoStatsInsightCards } from '@/components/health/who-stats/WhoStatsInsightCards'
import { WhoStatsLoading } from '@/components/health/who-stats/WhoStatsLoading'
import { WhoStatsSection } from '@/components/health/who-stats/WhoStatsSection'
import { WhoStatsTips } from '@/components/health/who-stats/WhoStatsTips'
import {
  GLANCE_KPI_KEYS,
  HEALTH_FOCUS_KEYS,
  pickKpis,
} from '@/lib/whoStatsDisplay'
import { fetchWhoPakistanStats } from '@/services/whoPakistanStatsService'
import type { WhoPakistanStatsResponse } from '@/types/whoStats'

function formatFetchedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' })
  } catch {
    return iso
  }
}

export default function HealthStatistics() {
  const { t } = useTranslation()
  const [data, setData] = useState<WhoPakistanStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      setData(await fetchWhoPakistanStats(force))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('whoStats.loadError'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const life = data?.kpis.find((k) => k.key === 'life_expectancy')
  const population = data?.kpis.find((k) => k.key === 'population')

  return (
    <div className="min-h-screen bg-background">
      <WhoStatsHero
        onRefresh={() => load(true)}
        refreshing={refreshing}
        loading={loading}
        whoProfileUrl={data?.country.whoDataUrl}
      />

      <div className="mx-auto max-w-6xl px-4 pb-16">
        {loading && <WhoStatsLoading />}

        {error && !loading && (
          <Card className="mt-8 border-destructive/40">
            <CardContent className="flex items-start gap-3 py-8">
              <AlertCircle className="mt-0.5 size-5 text-destructive" />
              <div>
                <p className="font-medium">{t('whoStats.loadError')}</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button className="mt-4" onClick={() => load()}>
                  {t('whoStats.retry')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {data && !loading && (
          <div className="space-y-2">
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('whoStats.dataNote', { date: formatFetchedAt(data.fetchedAt) })}
            </p>

            <WhoStatsSection
              eyebrow={t('whoStats.eyebrow1')}
              title={t('whoStats.sectionKnowTitle')}
              subtitle={t('whoStats.sectionKnowSubtitle')}
            >
              <WhoStatsHighlights life={life} population={population} />
            </WhoStatsSection>

            <WhoStatsSection
              variant="muted"
              eyebrow={t('whoStats.eyebrow2')}
              title={t('whoStats.glanceTitle')}
              subtitle={t('whoStats.glanceSubtitle')}
            >
              <WhoStatsInsightCards kpis={pickKpis(data.kpis, GLANCE_KPI_KEYS)} />
            </WhoStatsSection>

            <WhoStatsSection
              eyebrow={t('whoStats.eyebrow3')}
              title={t('whoStats.focusTitle')}
              subtitle={t('whoStats.focusSubtitle')}
            >
              <WhoStatsInsightCards kpis={pickKpis(data.kpis, HEALTH_FOCUS_KEYS)} />
            </WhoStatsSection>

            <WhoStatsSection
              variant="accent"
              eyebrow={t('whoStats.eyebrow4')}
              title={t('whoStats.causesSectionTitle')}
              subtitle={t('whoStats.causesSectionSubtitle')}
            >
              <WhoStatsCausesSection
                causes={data.leadingCauses}
                sourceYear={data.causesSourceYear ?? 2021}
              />
            </WhoStatsSection>

            <WhoStatsSection
              title={t('whoStats.tipsTitle')}
              subtitle={t('whoStats.tipsSubtitle')}
            >
              <WhoStatsTips />
            </WhoStatsSection>

            <div className="pt-6">
              <WhoStatsActionBanner />
            </div>

            <footer className="mt-10 space-y-4">
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-5 py-6 text-center">
                <p className="text-sm font-medium text-foreground">{t('whoStats.disclaimerTitle')}</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {t('whoStats.disclaimer')}
                </p>
                <p className="mt-4 text-xs text-muted-foreground/80">{t('whoStats.sourceLine')}</p>
              </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
