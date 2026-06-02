import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WhoStatsActionBanner() {
  const { t } = useTranslation()

  return (
    <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground shadow-lg md:px-10 md:py-12">
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-1/3 size-32 rounded-full bg-white/5"
        aria-hidden
      />
      <div className="relative max-w-xl">
        <h2 className="text-2xl font-bold md:text-3xl">{t('whoStats.bannerTitle')}</h2>
        <p className="mt-3 text-base leading-relaxed text-primary-foreground/90">
          {t('whoStats.bannerText')}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/symptom-checker">
            <Button size="lg" variant="secondary" className="shadow-md">
              {t('whoStats.ctaSymptoms')}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </Link>
          <Link to="/doctors">
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10"
            >
              <Stethoscope className="mr-2 size-4" />
              {t('whoStats.ctaDoctors')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
