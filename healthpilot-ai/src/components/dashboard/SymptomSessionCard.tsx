import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { SymptomSession } from '@/lib/database.types'
import { parseSessionAnalysis } from '@/services/dashboardService'
import { useAuthStore } from '@/store/authStore'
import { SEVERITY_CONFIG } from '@/utils/constants'
import { buildDoctorSearchUrl } from '@/utils/locationUtils'
import { cn } from '@/lib/utils'

interface SymptomSessionCardProps {
  session: SymptomSession
}

export function SymptomSessionCard({ session }: SymptomSessionCardProps) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuthStore()
  const analysis = parseSessionAnalysis(session)
  const severity = analysis?.severity_level
    ? SEVERITY_CONFIG[analysis.severity_level]
    : null

  const symptoms = session.symptoms_reported?.join(', ') ?? '—'
  const dateStr = format(new Date(session.created_at), 'dd MMM yyyy')

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-sm font-medium line-clamp-2">{symptoms}</p>
          {severity && (
            <Badge className={cn('shrink-0 border text-xs', severity.bg)}>
              {t(`severity.${analysis!.severity_level}`)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{dateStr}</p>
        {session.suggested_specialty && (
          <p className="mt-1 text-sm text-primary">
            → {session.suggested_specialty}
          </p>
        )}
        {i18n.language === 'ur' && analysis?.urdu_summary && (
          <p className="mt-2 text-xs text-muted-foreground" dir="rtl">
            {analysis.urdu_summary}
          </p>
        )}
        {session.suggested_specialty_slug && (
          <Link
            to={buildDoctorSearchUrl({
              specialty: session.suggested_specialty_slug,
              city: profile?.city ?? undefined,
              area: profile?.area ?? undefined,
            })}
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            {t('dashboard.findDoctorsForSpecialty')}
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
