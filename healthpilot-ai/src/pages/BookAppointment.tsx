import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDoctorById } from '@/services/doctorService'
import { createAppointment } from '@/services/bookingService'
import { useAuthStore } from '@/store/authStore'
import { useSymptomStore } from '@/store/symptomStore'
import { generateTimeSlots } from '@/utils/appointmentUtils'
import { formatPKR } from '@/utils/formatters'
import type { Doctor } from '@/lib/database.types'
import { cn } from '@/lib/utils'

export default function BookAppointment() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { sessionId } = useSymptomStore()
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    getDoctorById(id).then(setDoctor).catch(() => toast.error('Doctor not found'))
  }, [id])

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="mb-4 text-muted-foreground">Please sign in to book an appointment.</p>
        <Link to="/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    )
  }

  const availableTimes = doctor?.available_times as { start?: string; end?: string } | null
  const slots = availableTimes?.start && availableTimes?.end
    ? generateTimeSlots(availableTimes.start, availableTimes.end)
    : generateTimeSlots('09:00', '17:00')

  const handleBook = async () => {
    if (!doctor || !date || !time) {
      toast.error('Please select date and time')
      return
    }

    setSubmitting(true)
    try {
      await createAppointment({
        patientId: user.id,
        doctorId: doctor.id,
        sessionId: sessionId ?? undefined,
        date,
        time,
        notes,
        fee: doctor.consultation_fee ?? undefined,
      })
      toast.success('Appointment booked successfully!')
      navigate('/appointments')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Booking failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link
        to={`/doctors/${id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to doctor
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Book Appointment</CardTitle>
          <CardDescription>
            {doctor ? `with ${doctor.full_name}` : 'Loading...'}
            {doctor?.consultation_fee && ` — ${formatPKR(doctor.consultation_fee)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Time Slot</Label>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.isAvailable}
                  onClick={() => setTime(slot.time)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-sm transition-colors',
                    time === slot.time && 'border-primary bg-primary/10 text-primary',
                    !slot.isAvailable && 'cursor-not-allowed opacity-40'
                  )}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe your symptoms or reason for visit..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={handleBook} disabled={submitting}>
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
