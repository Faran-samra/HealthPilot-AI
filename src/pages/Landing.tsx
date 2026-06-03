import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe2,
  HeartPulse,
  MapPin,
  Navigation,
  Phone,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HealthAwarenessSection } from '@/components/health/HealthAwarenessSection'
import { cn } from '@/lib/utils'

const STATS = [
  { value: '7,000+', labelKey: 'landing.statDoctors' as const },
  { value: '50+', labelKey: 'landing.statCities' as const },
  { value: 'EN / اردو', labelKey: 'landing.statLanguages' as const },
  { value: '100%', labelKey: 'landing.statFree' as const },
]

export default function Landing() {
  const { t } = useTranslation()

  const quickActions = [
    {
      href: '/symptom-checker',
      icon: HeartPulse,
      title: t('landing.actionSymptoms'),
      description: t('landing.actionSymptomsDesc'),
      accent: 'from-emerald-500/15 to-primary/10',
    },
    {
      href: '/doctors',
      icon: Stethoscope,
      title: t('landing.actionDoctors'),
      description: t('landing.actionDoctorsDesc'),
      accent: 'from-primary/15 to-teal-500/10',
    },
    {
      href: '/healthcare-facilities',
      icon: Building2,
      title: t('landing.actionFacilities'),
      description: t('landing.actionFacilitiesDesc'),
      accent: 'from-sky-500/15 to-primary/10',
    },
    {
      href: '/health-info',
      icon: Activity,
      title: t('landing.actionHealth'),
      description: t('landing.actionHealthDesc'),
      accent: 'from-amber-500/10 to-primary/10',
    },
  ]

  const features = [
    { icon: HeartPulse, title: t('landing.feature1Title'), description: t('landing.feature1Desc') },
    { icon: Users, title: t('landing.feature2Title'), description: t('landing.feature2Desc') },
    { icon: Navigation, title: t('landing.feature3Title'), description: t('landing.feature3Desc') },
    { icon: Building2, title: t('landing.feature4Title'), description: t('landing.feature4Desc') },
    { icon: Globe2, title: t('landing.feature5Title'), description: t('landing.feature5Desc') },
    { icon: Shield, title: t('landing.feature6Title'), description: t('landing.feature6Desc') },
  ]

  const steps = [
    { step: '1', title: t('landing.step1Title'), text: t('landing.step1Text'), icon: HeartPulse },
    { step: '2', title: t('landing.step2Title'), text: t('landing.step2Text'), icon: Activity },
    { step: '3', title: t('landing.step3Title'), text: t('landing.step3Text'), icon: Stethoscope },
    { step: '4', title: t('landing.step4Title'), text: t('landing.step4Text'), icon: MapPin },
    { step: '5', title: t('landing.step5Title'), text: t('landing.step5Text'), icon: Phone },
  ]

  const whoBullets = [
    t('landing.whoBullet1'),
    t('landing.whoBullet2'),
    t('landing.whoBullet3'),
  ]

  return (
    <div className="overflow-x-hidden">
      {/* Hero */}
      <section className="relative border-b bg-gradient-to-b from-primary/[0.08] via-background to-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-24 start-1/4 size-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-1/2 end-0 size-[28rem] rounded-full bg-teal-400/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/90 px-4 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {t('landing.badge')}
            </div>

            <h1 className="mb-5 text-4xl font-bold tracking-tight text-balance leading-[1.25] md:text-5xl md:leading-[1.2] lg:text-6xl lg:leading-[1.18]">
              <span className="block pb-[0.08em]">{t('landing.title1')}</span>
              <span className="text-gradient-hero mt-1">{t('landing.title2')}</span>
            </h1>

            <p className="mb-8 text-lg leading-relaxed text-muted-foreground text-pretty md:text-xl">
              {t('landing.subtitle')}
            </p>

            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link to="/symptom-checker" className="sm:flex-1 sm:max-w-[14rem]">
                <Button size="lg" className="h-12 w-full gap-2 text-base shadow-md">
                  {t('landing.checkSymptoms')}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/doctors" className="sm:flex-1 sm:max-w-[14rem]">
                <Button size="lg" variant="outline" className="h-12 w-full text-base">
                  {t('landing.browseDoctors')}
                </Button>
              </Link>
            </div>
          </div>

          <dl className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
            {STATS.map((stat) => (
              <div
                key={stat.labelKey}
                className="rounded-2xl border bg-card/70 px-3 py-5 text-center shadow-sm backdrop-blur transition-all hover:border-primary/25 hover:shadow-md"
              >
                <dt className="text-xl font-bold text-primary md:text-2xl">{stat.value}</dt>
                <dd className="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">
                  {t(stat.labelKey)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* What is HealthPilot */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold md:text-3xl">{t('landing.whatIsTitle')}</h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
            {t('landing.whatIsP1')}
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            {t('landing.whatIsP2')}
          </p>
        </div>
      </section>

      {/* Quick start */}
      <section className="border-y bg-muted/20 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold md:text-3xl">
            {t('landing.quickStart')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                to={action.href}
                className="group block rounded-2xl outline-none ring-primary/30 focus-visible:ring-2"
              >
                <Card
                  className={cn(
                    'h-full border bg-card/80 transition-all duration-300',
                    'group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-lg',
                    'bg-gradient-to-br',
                    action.accent
                  )}
                >
                  <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/50">
                      <action.icon className="size-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 text-start">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {action.title}
                        <ArrowRight className="size-4 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </CardTitle>
                      <CardDescription className="mt-1.5 text-sm leading-relaxed">
                        {action.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-2xl font-bold md:text-3xl">{t('landing.howItWorks')}</h2>
          <p className="mt-3 text-muted-foreground">{t('landing.howItWorksSubtitle')}</p>
        </div>

        <div className="space-y-4">
          {steps.map((item) => (
            <div
              key={item.step}
              className="flex gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md md:gap-6 md:p-6"
            >
              <div className="flex shrink-0 flex-col items-center gap-2">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                  {item.step}
                </div>
                <item.icon className="size-5 text-primary/70" aria-hidden />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why HealthPilot */}
      <section className="border-y bg-muted/20 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-2xl font-bold md:text-3xl">{t('landing.whyUs')}</h2>
            <p className="mt-3 text-muted-foreground">{t('landing.whyUsSubtitle')}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="h-full border-muted/80 bg-card/90 transition-all hover:border-primary/20 hover:shadow-md"
              >
                <CardHeader>
                  <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10">
                    <feature.icon className="size-5 text-primary" />
                  </div>
                  <CardTitle className="text-base leading-snug">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="-mt-2">
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* WHO Pakistan */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <Card className="overflow-hidden border-sky-200/60 bg-gradient-to-br from-sky-50/80 via-card to-primary/5 dark:border-sky-900/40 dark:from-sky-950/20">
          <CardContent className="grid gap-8 p-6 md:grid-cols-2 md:p-10">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                <Globe2 className="size-3.5" />
                WHO · Global Health Observatory
              </div>
              <h2 className="text-2xl font-bold md:text-3xl">{t('landing.whoTitle')}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
                {t('landing.whoDesc')}
              </p>
              <ul className="mt-5 space-y-2.5">
                {whoBullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2 text-sm md:text-base">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <Link to="/health-statistics" className="mt-6 inline-block">
                <Button className="gap-2">
                  {t('landing.whoCta')}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <p className="mt-4 text-xs text-muted-foreground">{t('landing.whoSource')}</p>
            </div>
            <div className="flex flex-col justify-center gap-3 rounded-xl border border-dashed border-sky-200/80 bg-background/60 p-5 dark:border-sky-800/50">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
                <Globe2 className="size-8 text-sky-600 dark:text-sky-400" />
                <div>
                  <p className="font-semibold">World Health Organization</p>
                  <p className="text-sm text-muted-foreground">Pakistan national indicators</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('whoStats.heroCardText')}
              </p>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg border bg-card p-3">
                  <p className="font-bold text-primary">Life expectancy</p>
                  <p className="mt-0.5 text-muted-foreground">National average</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="font-bold text-primary">Leading causes</p>
                  <p className="mt-0.5 text-muted-foreground">Charts & tips</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <HealthAwarenessSection />

      {/* Medical disclaimer */}
      <section className="border-t bg-muted/30 py-8">
        <p className="mx-auto max-w-3xl px-4 text-center text-sm leading-relaxed text-muted-foreground">
          {t('landing.medicalDisclaimer')}
        </p>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/30 py-16 md:py-20">
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <h2 className="mb-3 text-2xl font-bold md:text-3xl">{t('landing.readyTitle')}</h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">{t('landing.readySubtitle')}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/symptom-checker">
              <Button size="lg" className="min-w-[10.5rem] gap-2">
                {t('landing.ctaSymptoms')}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/doctors">
              <Button size="lg" variant="secondary" className="min-w-[10.5rem]">
                {t('landing.ctaDoctors')}
              </Button>
            </Link>
            <Link to="/healthcare-facilities">
              <Button size="lg" variant="outline" className="min-w-[10.5rem]">
                {t('landing.ctaFacilities')}
              </Button>
            </Link>
            <Link to="/health-statistics">
              <Button size="lg" variant="outline" className="min-w-[10.5rem] gap-2">
                <Globe2 className="size-4" />
                {t('landing.ctaWho')}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
