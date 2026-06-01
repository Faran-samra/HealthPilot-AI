import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnalysisResultPanel } from '@/components/symptoms/AnalysisResultPanel'
import { useCareLocation } from '@/hooks/useCareLocation'
import { useSymptomStore } from '@/store/symptomStore'
import { useAuthStore } from '@/store/authStore'

export default function AnalysisResultPage() {
  const { t } = useTranslation()
  const { analysis } = useSymptomStore()
  const { profile } = useAuthStore()
  const { careLocation, loading: careLocationLoading } = useCareLocation(profile?.city, true)

  if (!analysis) {
    return <Navigate to="/symptom-checker" replace />
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/symptom-checker" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t('symptoms.backToChat')}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('symptoms.resultsTitle')}</h1>
        <p className="text-muted-foreground">{t('symptoms.resultsSubtitle')}</p>
      </div>

      <AnalysisResultPanel
        analysis={analysis}
        careLocation={careLocation}
        locationLoading={careLocationLoading}
        area={profile?.area}
        showFullDetails
      />

      <Link to="/symptom-checker" className="mt-6 block">
        <Button variant="outline" className="w-full">{t('symptoms.newChat')}</Button>
      </Link>
    </div>
  )
}
