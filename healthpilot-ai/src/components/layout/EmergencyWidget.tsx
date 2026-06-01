import { useState } from 'react'
import { Phone, Siren, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getEmergencyServicesForCity } from '@/utils/constants'
import { useAuthStore } from '@/store/authStore'
import { capitalizeCity } from '@/utils/formatters'

export function EmergencyWidget() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuthStore()
  const [open, setOpen] = useState(false)
  const city = profile?.city ?? 'lahore'
  const services = getEmergencyServicesForCity(city)
  const isUrdu = i18n.language === 'ur'

  return (
    <>
      <Button
        size="icon-lg"
        className="fixed bottom-6 end-6 z-50 size-14 rounded-full bg-red-600 shadow-lg hover:bg-red-700"
        onClick={() => setOpen(true)}
        aria-label={t('emergency.title')}
      >
        <Siren className="size-6 text-white" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-background p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-red-600">{t('emergency.title')}</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <p className="mb-2 text-sm text-muted-foreground">{t('emergency.subtitle')}</p>
            <p className="mb-4 text-xs font-medium text-primary">
              {t('emergency.cityNote', { city: capitalizeCity(city) })}
            </p>

            <div className="space-y-2">
              {services.map((service) => (
                <a
                  key={service.key}
                  href={`tel:${service.number}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{service.icon}</span>
                    <span className="text-sm font-medium">
                      {isUrdu ? service.labelUr : service.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-semibold text-red-600">
                    <Phone className="size-4" />
                    {service.number}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
