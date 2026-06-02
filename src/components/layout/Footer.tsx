import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const FOOTER_LINKS = [
  { to: '/symptom-checker', key: 'nav.symptomChecker' },
  { to: '/doctors', key: 'nav.findDoctors' },
  { to: '/healthcare-facilities', key: 'nav.healthcareFacilities' },
  { to: '/health-info', key: 'nav.healthInfo' },
  { to: '/health-statistics', key: 'nav.healthStatistics' },
] as const

export function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto shrink-0 border-t bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Activity className="size-4 shrink-0" aria-hidden />
            <span>{t('common.appName')}</span>
          </div>

          <nav
            className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:justify-end"
            aria-label={t('footer.quickLinks')}
          >
            {FOOTER_LINKS.map(({ to, key }) => (
              <Link key={to} to={to} className="hover:text-foreground whitespace-nowrap">
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-2 text-[11px] leading-snug text-muted-foreground/90 sm:max-w-3xl">
          {t('footer.disclaimerShort')}
        </p>

        <p className="mt-2 text-[11px] text-muted-foreground">
          © {year} {t('common.appName')} — {t('footer.copyright')}
        </p>
      </div>
    </footer>
  )
}
