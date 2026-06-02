import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, MapPin, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onRefresh: () => void
  refreshing: boolean
  loading: boolean
}

export function WhoStatsHero({ onRefresh, refreshing, loading }: Props) {
  const { t } = useTranslation()

  return (
    <section className="relative overflow-hidden border-b border-primary/10">
      <div
        className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-10 size-56 rounded-full bg-emerald-400/10 blur-3xl"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/8 via-background to-background" />

      <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-4 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur">
              <MapPin className="size-4" />
              {t('whoStats.badge')}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl md:leading-tight">
              {t('whoStats.title')}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {t('whoStats.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/symptom-checker">
                <Button size="lg" className="shadow-md">
                  <Activity className="mr-2 size-4" />
                  {t('whoStats.ctaSymptoms')}
                </Button>
              </Link>
              <Link to="/health-info">
                <Button size="lg" variant="outline" className="bg-background/80">
                  {t('whoStats.ctaAwareness')}
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 rounded-2xl border border-primary/15 bg-card/90 p-5 shadow-lg backdrop-blur-sm lg:max-w-xs">
            <p className="text-sm font-medium text-foreground">{t('whoStats.heroCardTitle')}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t('whoStats.heroCardText')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              disabled={loading || refreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {t('whoStats.refresh')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
