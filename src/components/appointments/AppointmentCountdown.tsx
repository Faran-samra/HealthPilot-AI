import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getAppointmentCountdown } from '@/utils/appointmentCountdown'

interface AppointmentCountdownProps {
  date: string
  time: string
}

export function AppointmentCountdown({ date, time }: AppointmentCountdownProps) {
  const { t } = useTranslation()
  const countdown = getAppointmentCountdown(date, time)

  if (!countdown) return null

  return (
    <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
      <Clock className="size-3" />
      {t('dashboard.inCountdown', { time: countdown })}
    </Badge>
  )
}
