import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle, Siren, Stethoscope } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SymptomActionCards } from '@/components/symptoms/SymptomActionCards'
import { RecommendedDoctorsPanel } from '@/components/symptoms/RecommendedDoctorsPanel'
import { RecommendedDirectoryDoctorsPanel } from '@/components/symptoms/RecommendedDirectoryDoctorsPanel'
import { AnalysisFeedback } from '@/components/symptoms/AnalysisFeedback'
import type { SymptomAnalysisExtended } from '@/types/symptomChat'
import type { CareLocation } from '@/utils/locationUtils'
import { SEVERITY_CONFIG } from '@/utils/constants'
import { cn } from '@/lib/utils'

interface AnalysisResultPanelProps {
  analysis: SymptomAnalysisExtended
  careLocation: CareLocation | null
  locationLoading?: boolean
  area?: string | null
  traceId?: string | null
  sessionId?: string | null
  showFullDetails?: boolean
}

export function AnalysisResultPanel({
  analysis,
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

      {showFullDetails && (
        <>
          {analysis.possible_conditions.length > 0 && (
            <CollapsibleSection
              title={t('symptoms.possibleConcerns')}
              icon={<AlertTriangle className="size-4 text-yellow-600" />}
            >
              <ul className="space-y-1">
                {analysis.possible_conditions.map((condition) => (
                  <li key={condition} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-yellow-600" />
                    {condition}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          <CollapsibleSection
            title={t('symptoms.explanation')}
            defaultOpen={false}
          >
            <p className="leading-relaxed">{analysis.explanation}</p>
          </CollapsibleSection>

          {analysis.first_aid_tips.length > 0 && (
            <CollapsibleSection
              title={t('symptoms.firstAidTips')}
              icon={<CheckCircle className="size-4 text-green-600" />}
            >
              <ul className="space-y-2">
                {analysis.first_aid_tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
                    {tip}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {analysis.red_flags.length > 0 && (
            <CollapsibleSection
              title={t('symptoms.redFlags')}
              variant="warning"
              icon={<AlertTriangle className="size-4 text-orange-700" />}
            >
              <ul className="space-y-1">
                {analysis.red_flags.map((flag) => (
                  <li key={flag} className="text-orange-800">• {flag}</li>
                ))}
              </ul>
            </CollapsibleSection>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">{analysis.disclaimer}</p>
    </div>
  )
}
