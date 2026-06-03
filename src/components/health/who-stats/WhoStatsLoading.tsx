import { useTranslation } from 'react-i18next'
import { Globe2, Loader2 } from 'lucide-react'

export function WhoStatsLoading() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
      <div className="relative">
        <Globe2 className="size-12 text-sky-500/30" />
        <Loader2 className="absolute inset-0 m-auto size-10 animate-spin text-primary" />
      </div>
      <p className="mt-6 text-lg font-medium">{t('whoStats.loadingTitle')}</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
        {t('whoStats.loadingHint')}
      </p>
      <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl bg-gradient-to-br from-muted to-muted/50"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
