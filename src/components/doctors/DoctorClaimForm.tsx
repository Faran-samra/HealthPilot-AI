import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { submitDoctorClaim } from '@/services/doctorClaimService'
import { useAuthStore } from '@/store/authStore'
import { Link } from 'react-router-dom'

interface Props {
  doctorId: string
  doctorName: string
}

export function DoctorClaimForm({ doctorId, doctorName }: Props) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [pmdc, setPmdc] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4 text-sm text-muted-foreground">
          {t('directory.claimLogin')}{' '}
          <Link to="/login" className="text-primary underline">
            {t('common.login')}
          </Link>
        </CardContent>
      </Card>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submitDoctorClaim({
        doctorId,
        pmdcNumber: pmdc.trim() || undefined,
        phone: phone.trim() || undefined,
        evidence: { claimed_name: doctorName },
      })
      toast.success(t('directory.claimSubmitted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('directory.claimError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('directory.claimTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('directory.claimSubtitle')}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder={t('directory.claimPmdc')}
            value={pmdc}
            onChange={(e) => setPmdc(e.target.value)}
          />
          <Input
            placeholder={t('directory.claimPhone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? t('common.loading') : t('directory.claimSubmit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
