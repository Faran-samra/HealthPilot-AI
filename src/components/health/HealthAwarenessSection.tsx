import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, Bug, Droplets, Heart, Thermometer, Wind } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const conditions = [
  { key: 'dengue', icon: Bug, color: 'text-orange-600' },
  { key: 'typhoid', icon: Thermometer, color: 'text-red-600' },
  { key: 'hepatitis', icon: Droplets, color: 'text-yellow-600' },
  { key: 'diabetes', icon: Activity, color: 'text-blue-600' },
  { key: 'hypertension', icon: Heart, color: 'text-rose-600' },
  { key: 'malaria', icon: Wind, color: 'text-green-600' },
] as const

export function HealthAwarenessSection() {
  const { t } = useTranslation()

  return (
    <section className="bg-muted/30 py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold md:text-3xl">{t('health.title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('health.subtitle')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {conditions.map(({ key, icon: Icon, color }) => (
            <Card key={key}>
              <CardHeader>
                <Icon className={`mb-2 size-7 ${color}`} />
                <CardTitle className="text-base">{t(`health.${key}Title`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {t(`health.${key}Desc`)}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link to="/symptom-checker">
            <Button size="lg">{t('health.learnMore')}</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
