import { Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { PmdcBadge } from './PmdcBadge'

interface DoctorBadgesProps {
  isVerified?: boolean
  pmdcNumber?: string | null
  gender?: string | null
  acceptsOnline?: boolean
  compact?: boolean
}

export function DoctorBadges({
  isVerified,
  pmdcNumber,
  gender,
  acceptsOnline,
  compact = false,
}: DoctorBadgesProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (
        <PmdcBadge pmdcNumber={pmdcNumber} isVerified={isVerified} showVerifyLink={false} />
      )}
      {gender === 'female' && (
        <Badge variant="secondary" className="bg-pink-50 text-pink-800">
          {t('common.femaleDoctor')}
        </Badge>
      )}
      {acceptsOnline && (
        <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700">
          <Video className="size-3" />
          {t('common.onlineConsult')}
        </Badge>
      )}
    </div>
  )
}
