export interface TimeSlot {
  time: string
  isAvailable: boolean
}

function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function formatTimeFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes = 30,
  bookedSlots: string[] = []
): TimeSlot[] {
  const slots: TimeSlot[] = []
  let current = parseTime(startTime)
  const end = parseTime(endTime)

  while (current < end) {
    const timeStr = formatTimeFromMinutes(current)
    slots.push({
      time: timeStr,
      isAvailable: !bookedSlots.includes(timeStr),
    })
    current += durationMinutes
  }

  return slots
}

export function getWhatsAppBookingLink(
  whatsapp: string,
  message: string
): string {
  const number = whatsapp.replace(/\D/g, '')
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function getWhatsAppVideoLink(whatsapp: string, doctorName: string): string {
  return getWhatsAppBookingLink(
    whatsapp,
    `Assalam o Alaikum, I would like to request a video/online consultation with ${doctorName}.`
  )
}
