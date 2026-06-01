import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2 font-semibold text-primary">
            <Activity className="size-5" />
            {t('common.appName')}
          </div>
          <p className="text-sm text-muted-foreground">{t('footer.tagline')}</p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('footer.quickLinks')}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/symptom-checker" className="hover:text-foreground">
                {t('nav.symptomChecker')}
              </Link>
            </li>
            <li>
              <Link to="/doctors" className="hover:text-foreground">
                {t('nav.findDoctors')}
              </Link>
            </li>
            <li>
              <Link to="/health-info" className="hover:text-foreground">
                {t('nav.healthInfo')}
              </Link>
            </li>
            <li>
              <Link to="/register" className="hover:text-foreground">
                {t('common.register')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t('footer.disclaimerTitle')}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('footer.disclaimer')}</p>
        </div>
      </div>

      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t('common.appName')} — {t('footer.copyright')}
      </div>
    </footer>
  )
}
