export function getAppointmentCountdown(date: string, time: string): string | null {
  const target = new Date(`${date}T${time}`)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()

  if (diffMs <= 0) return null

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
