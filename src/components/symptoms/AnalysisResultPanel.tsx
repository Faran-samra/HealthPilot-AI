import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, Siren, Stethoscope } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SymptomActionCards } from '@/components/symptoms/SymptomActionCards'
import { RecommendedDoctorsPanel } from '@/components/symptoms/RecommendedDoctorsPanel'
import { RecommendedDirectoryDoctorsPanel } from '@/components/symptoms/RecommendedDirectoryDoctorsPanel'
import { AnalysisFeedback } from '@/components/symptoms/AnalysisFeedback'
import type { RagSourceCitation, SymptomAnalysisExtended } from '@/types/symptomChat'
import type { CareLocation } from '@/utils/locationUtils'
import { SEVERITY_CONFIG } from '@/utils/constants'
import {
  dedupeRagSources,
  formatRagCitationSubtitle,
  formatRagCitationTitle,
} from '@/utils/ragCitationDisplay'
import { cn } from '@/lib/utils'

interface AnalysisResultPanelProps {
  analysis: SymptomAnalysisExtended
  ragSources?: RagSourceCitation[]
  careLocation: CareLocation | null
  locationLoading?: boolean
  area?: string | null
  traceId?: string | null
  sessionId?: string | null
  showFullDetails?: boolean
}

export function AnalysisResultPanel({
  analysis,
  ragSources = [],
  careLocation,
  locationLoading,
  area,
  traceId,
  sessionId,
  showFullDetails = false,
}: AnalysisResultPanelProps) {
  const { t } = useTranslation()
  const severityKey = analysis.severity_level
  const severity = SEVERITY_CONFIG[severityKey]
  const isEmergency = severityKey === 'emergency'
  const displayRagSources = dedupeRagSources(ragSources)

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isEmergency && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex items-start gap-3 p-4">
            <Siren className="mt-0.5 size-5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold text-red-800">{t('symptoms.emergencyTitle')}</p>
              <p className="text-sm text-red-700">{t('symptoms.emergencyText')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn('border px-3 py-1 text-sm', severity.bg)}>
          {t(`severity.${severityKey}`)}
        </Badge>
        {analysis.condition_confidence && (
          <Badge variant="outline" className="text-xs capitalize">
            {analysis.condition_confidence} confidence
          </Badge>
        )}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4 text-primary" />
            {t('symptoms.recommendedSpecialist')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-semibold text-primary">{analysis.recommended_specialty}</p>
          {analysis.primary_condition && (
            <p className="mt-1 text-sm font-medium">{analysis.primary_condition}</p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {analysis.brief_summary ?? analysis.explanation.slice(0, 200)}
          </p>
          {analysis.urdu_summary && (
            <p className="mt-2 text-sm text-muted-foreground" dir="rtl">
              {analysis.urdu_summary}
            </p>
          )}
        </CardContent>
      </Card>

      {displayRagSources.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('symptoms.ragSourcesTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-xs text-muted-foreground">{t('symptoms.ragSourcesHint')}</p>
            <ul className="space-y-2 text-sm">
              {displayRagSources.map((src, index) => (
                <li
                  key={`${formatRagCitationTitle(src)}-${index}`}
                  className="rounded-md border border-blue-100 bg-white/70 px-3 py-2"
                >
                  <p className="font-medium leading-snug">{formatRagCitationTitle(src)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatRagCitationSubtitle(src)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {showFullDetails && analysis.explanation && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('symptoms.explanation')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{analysis.explanation}</p>
          </CardContent>
        </Card>
      )}

      {showFullDetails && analysis.possible_conditions.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-yellow-600" />
              {t('symptoms.possibleConcerns')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {analysis.possible_conditions.map((condition) => (
                <li key={condition} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-yellow-600" />
                  {condition}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {showFullDetails && analysis.first_aid_tips.length > 0 && (
        <Card className="border-green-200 bg-green-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="size-4 text-green-600" />
              {t('symptoms.firstAidTips')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {analysis.first_aid_tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {showFullDetails && analysis.red_flags.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-orange-700" />
              {t('symptoms.redFlags')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-orange-900">
              {analysis.red_flags.map((flag) => (
                <li key={flag}>• {flag}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <SymptomActionCards analysis={analysis} careLocation={careLocation} area={area} />

      <RecommendedDirectoryDoctorsPanel
        analysis={analysis}
        careLocation={careLocation}
        locationLoading={locationLoading}
      />

      <RecommendedDoctorsPanel
        analysis={analysis}
        careLocation={careLocation}
        locationLoading={locationLoading}
      />

      <AnalysisFeedback traceId={traceId} sessionId={sessionId} />

      <p className="text-xs text-muted-foreground">{analysis.disclaimer}</p>
    </div>
  )
}
