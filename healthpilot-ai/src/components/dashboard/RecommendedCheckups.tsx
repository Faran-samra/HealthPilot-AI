import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HeartPulse } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getRecommendedCheckups, type CheckupRecommendation } from '@/utils/checkupRecommendations'

interface RecommendedCheckupsProps {
  age?: number | null
  gender?: string | null
}

export function RecommendedCheckups({ age, gender }: RecommendedCheckupsProps) {
  const { t } = useTranslation()
  const checkups = getRecommendedCheckups(age, gender)

  return (
    <Card>
      <CardHeader>
        <HeartPulse className="mb-2 size-6 text-primary" />
        <CardTitle className="text-base">{t('dashboard.recommendedCheckups')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checkups.map((item: CheckupRecommendation) => (
          <div key={item.id} className="rounded-lg border p-3">
            <p className="text-sm font-medium">{t(item.titleKey)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t(item.descKey)}</p>
            {item.specialtySlug && (
              <Link to={`/doctors?specialty=${item.specialtySlug}`}>
                <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs">
                  {t('dashboard.findSpecialist')}
                </Button>
              </Link>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
