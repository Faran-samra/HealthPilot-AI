import { ExternalLink, Verified } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'

const PMDC_VERIFY_URL = 'https://www.pmdc.org.pk/'

interface PmdcBadgeProps {
  pmdcNumber?: string | null
  isVerified?: boolean
  showVerifyLink?: boolean
}

export function PmdcBadge({ pmdcNumber, isVerified, showVerifyLink = true }: PmdcBadgeProps) {
  const { t } = useTranslation()

  if (!isVerified && !pmdcNumber) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isVerified && (
        <Badge variant="outline" className="gap-1 border-green-300 text-green-700">
          <Verified className="size-3" />
          PMDC {t('common.verified')}
        </Badge>
      )}
      {pmdcNumber && (
        <span className="text-xs text-muted-foreground">#{pmdcNumber}</span>
      )}
      {showVerifyLink && pmdcNumber && (
        <a
          href={PMDC_VERIFY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t('doctors.verifyPmdc')}
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  )
}
