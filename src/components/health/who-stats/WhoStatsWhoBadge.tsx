import { useTranslation } from 'react-i18next'
import { ExternalLink, Globe2 } from 'lucide-react'
import { WHO_PAKISTAN_PROFILE_URL } from '@/lib/whoStatsDisplay'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
  whoProfileUrl?: string
}

/** Compact WHO / GHO attribution — one slim row, no extra vertical space. */
export function WhoStatsWhoBadge({ className, whoProfileUrl }: Props) {
  const { t } = useTranslation()
  const profileUrl = whoProfileUrl?.trim() || WHO_PAKISTAN_PROFILE_URL

  return (
    <aside
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border border-sky-200/70 bg-sky-50/50 px-3 py-2 dark:border-sky-900/50 dark:bg-sky-950/25',
        className,
      )}
      aria-label={t('whoStats.whoOrgName')}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-600 text-white">
          <Globe2 className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-xs font-semibold text-foreground">{t('whoStats.whoOrgShort')}</p>
          <p className="truncate text-[10px] text-muted-foreground">{t('whoStats.whoGhoShort')}</p>
        </div>
      </div>
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-100/80 dark:text-sky-200 dark:hover:bg-sky-900/40"
      >
        <span className="hidden sm:inline">{t('whoStats.whoProfileLink')}</span>
        <span className="sm:hidden">WHO</span>
        <ExternalLink className="size-3 opacity-70" aria-hidden />
      </a>
    </aside>
  )
}
