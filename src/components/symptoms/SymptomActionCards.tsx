import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Calendar,
  Hospital,
  MapPin,
  Search,
  Siren,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { SymptomAnalysisExtended } from '@/types/symptomChat'
import { buildDoctorSearchUrl, buildHealthcareFacilitiesUrl, type CareLocation } from '@/utils/locationUtils'

interface SymptomActionCardsProps {
  analysis: SymptomAnalysisExtended
  careLocation: CareLocation | null
  area?: string | null
}

export function SymptomActionCards({ analysis, careLocation, area }: SymptomActionCardsProps) {
  const { t } = useTranslation()
  const isEmergency = analysis.severity_level === 'emergency'
  const citySlug = careLocation?.citySlug
  const useGps = careLocation?.source === 'gps'

  const doctorUrl = buildDoctorSearchUrl({
    specialty: analysis.recommended_specialty_slug,
    city: citySlug,
    area: area ?? undefined,
    nearMe: useGps,
  })
  const hospitalUrl = buildHealthcareFacilitiesUrl({
    specialty: analysis.recommended_specialty_slug,
    city: citySlug,
    nearMe: useGps,
  })

  const actions = [
    {
      icon: Search,
      title: t('symptoms.actionFindSpecialist', { specialty: analysis.recommended_specialty }),
      desc: t('symptoms.actionFindSpecialistDesc'),
      href: doctorUrl,
      primary: true,
    },
    {
      icon: Hospital,
      title: t('symptoms.actionHospitals'),
      desc: t('symptoms.actionHospitalsDesc'),
      href: hospitalUrl,
      primary: false,
    },
    {
      icon: Calendar,
      title: t('symptoms.actionBook'),
      desc: t('symptoms.actionBookDesc'),
      href: doctorUrl,
      primary: false,
    },
    {
      icon: isEmergency ? Siren : MapPin,
      title: isEmergency ? t('symptoms.actionEmergency') : t('symptoms.actionNearMe'),
      desc: isEmergency ? t('symptoms.actionEmergencyDesc') : t('symptoms.actionNearMeDesc'),
      href: isEmergency ? '/health-info' : buildHealthcareFacilitiesUrl({ city: citySlug, nearMe: true }),
      primary: isEmergency,
      danger: isEmergency,
    },
  ]

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="size-4 text-primary" />
        {t('symptoms.nextActions')}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link key={action.title} to={action.href}>
            <Card
              className={`h-full transition-colors hover:border-primary/50 hover:bg-muted/30 ${
                action.danger ? 'border-red-200 bg-red-50' : ''
              }`}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={`rounded-lg p-2 ${
                    action.danger
                      ? 'bg-red-100 text-red-700'
                      : action.primary
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <action.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {analysis.primary_condition && analysis.condition_confidence === 'high' && (
        <p className="text-xs text-muted-foreground">
          {t('symptoms.conditionDetected', { condition: analysis.primary_condition })}
        </p>
      )}
    </div>
  )
}
