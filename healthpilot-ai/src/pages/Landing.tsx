import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ArrowRight,
  MapPin,
  MessageCircle,
  Shield,
  Stethoscope,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HealthAwarenessSection } from '@/components/health/HealthAwarenessSection'

export default function Landing() {
  const { t } = useTranslation()

  const features = [
    { icon: Stethoscope, title: t('landing.feature1Title'), description: t('landing.feature1Desc') },
    { icon: MapPin, title: t('landing.feature2Title'), description: t('landing.feature2Desc') },
    { icon: MessageCircle, title: t('landing.feature3Title'), description: t('landing.feature3Desc') },
    { icon: Shield, title: t('landing.feature4Title'), description: t('landing.feature4Desc') },
  ]

  const steps = [
    { step: '1', title: t('landing.step1Title'), text: t('landing.step1Text') },
    { step: '2', title: t('landing.step2Title'), text: t('landing.step2Text') },
    { step: '3', title: t('landing.step3Title'), text: t('landing.step3Text') },
    { step: '4', title: t('landing.step4Title'), text: t('landing.step4Text') },
  ]

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/20">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm text-muted-foreground">
              <Activity className="size-4 text-primary" />
              {t('landing.badge')}
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              {t('landing.title1')}
              <span className="block text-primary">{t('landing.title2')}</span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl">{t('landing.subtitle')}</p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/symptom-checker">
                <Button size="lg" className="gap-2">
                  {t('landing.checkSymptoms')}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/doctors">
                <Button size="lg" variant="outline">
                  {t('landing.browseDoctors')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold md:text-3xl">{t('landing.howItWorks')}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <Card key={item.step} className="text-center">
              <CardHeader>
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {item.step}
                </div>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{item.text}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold md:text-3xl">{t('landing.whyUs')}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <feature.icon className="mb-2 size-8 text-primary" />
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <HealthAwarenessSection />

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold">{t('landing.readyTitle')}</h2>
        <p className="mb-6 text-muted-foreground">{t('landing.readySubtitle')}</p>
        <Link to="/register">
          <Button size="lg">{t('landing.createAccount')}</Button>
        </Link>
      </section>
    </div>
  )
}
