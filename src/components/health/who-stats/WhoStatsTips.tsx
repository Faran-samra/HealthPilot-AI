import { useTranslation } from 'react-i18next'
import { Baby, Heart, Thermometer, Stethoscope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TIP_ICONS: Record<string, LucideIcon> = {
  '1': Thermometer,
  '2': Baby,
  '3': Heart,
  '4': Stethoscope,
}

const TIP_COLORS: Record<string, string> = {
  '1': 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  '2': 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  '3': 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  '4': 'bg-primary/10 text-primary',
}

export function WhoStatsTips() {
  const { t } = useTranslation()
  const tips = ['1', '2', '3', '4'] as const

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {tips.map((n) => {
        const Icon = TIP_ICONS[n]
        return (
          <div
            key={n}
            className="flex gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
          >
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${TIP_COLORS[n]}`}
            >
              <Icon className="size-5" />
            </div>
            <p className="text-sm leading-relaxed text-foreground">{t(`whoStats.tip${n}`)}</p>
          </div>
        )
      })}
    </div>
  )
}
