import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { parseProfileDetails } from '@/types/doctorProfile'
import { sanitizeProfessionalStatement } from '@/utils/htmlText'
import { cleanMarhamListItems } from '@/utils/marhamProfileText'
import {
  formatTime12h,
  getPracticeTimingsFromDoctor,
} from '@/utils/practiceTimings'
import type { Doctor } from '@/lib/database.types'

interface Props {
  profileDetails: unknown
  availableTimes?: unknown
}

export function DoctorProfileExtras({ profileDetails, availableTimes }: Props) {
  const { t } = useTranslation()
  const details = parseProfileDetails(profileDetails)
  const doctorLike = {
    profile_details: profileDetails,
    available_times: availableTimes,
  } as Pick<Doctor, 'profile_details' | 'available_times'>
  const timings = getPracticeTimingsFromDoctor(doctorLike)
  const statement = sanitizeProfessionalStatement(details.professional_statement)
  const services = cleanMarhamListItems(details.services)
  const diseases = cleanMarhamListItems(details.diseases)

  const hasExtras =
    timings.length > 0 ||
    Boolean(statement) ||
    services.length > 0 ||
    diseases.length > 0

  if (!hasExtras) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">{t('doctors.noPracticeTimings')}</p>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('doctors.practiceTimings')}</CardTitle>
        </CardHeader>
        <CardContent>
          {timings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-muted-foreground">
                    <th className="pb-2 pe-4 font-medium">{t('doctors.day')}</th>
                    <th className="pb-2 font-medium">{t('doctors.timings')}</th>
                  </tr>
                </thead>
                <tbody>
                  {timings.map((row) => (
                    <tr key={row.day} className="border-b border-dashed last:border-0">
                      <td className="py-2 pe-4 font-medium">{row.day}</td>
                      <td className="py-2 text-muted-foreground">
                        {formatTime12h(row.start)} – {formatTime12h(row.end)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('doctors.noPracticeTimings')}</p>
          )}
        </CardContent>
      </Card>

      {statement && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('doctors.professionalStatement')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{statement}</p>
          </CardContent>
        </Card>
      )}

      {services.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('doctors.services')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {services.map((s) => (
              <Badge key={s} variant="secondary">
                {s}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {diseases.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('doctors.diseasesTreated')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {diseases.map((d) => (
              <Badge key={d} variant="outline">
                {d}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
