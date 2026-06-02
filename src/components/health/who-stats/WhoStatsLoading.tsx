import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

export function WhoStatsLoading() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Loader2 className="size-10 animate-spin text-primary" />
      <p className="mt-4 text-lg font-medium">{t('whoStats.loadingTitle')}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('whoStats.loadingHint')}</p>
      <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
