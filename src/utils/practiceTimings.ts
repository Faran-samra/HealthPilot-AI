import type { Doctor } from '@/lib/database.types'
import { parseProfileDetails, type PracticeTimingRow } from '@/types/doctorProfile'
import { generateTimeSlots, type TimeSlot } from '@/utils/appointmentUtils'

const JS_DAY_TO_MARHAM = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function getPracticeTimingsFromDoctor(
  doctor: Pick<Doctor, 'profile_details' | 'available_times'>
): PracticeTimingRow[] {
  const details = parseProfileDetails(doctor.profile_details)
  const at = doctor.available_times as { practice_timings?: PracticeTimingRow[] } | null
  return details.practice_timings ?? at?.practice_timings ?? []
}

export function formatTime12h(time24: string): string {
  const m = time24.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return time24
  let h = parseInt(m[1], 10)
  const min = m[2]
  const pm = h >= 12
  if (h > 12) h -= 12
  if (h === 0) h = 12
  return `${h}:${min} ${pm ? 'PM' : 'AM'}`
}

function normalizeDayKey(day: string): string {
  return day.trim().slice(0, 3).toLowerCase()
}

export function findTimingForDate(
  timings: PracticeTimingRow[],
  dateIso: string
): PracticeTimingRow | null {
  if (!dateIso || timings.length === 0) return null
  const d = new Date(`${dateIso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const key = JS_DAY_TO_MARHAM[d.getDay()].toLowerCase()
  return (
    timings.find((t) => normalizeDayKey(t.day) === key) ??
    timings.find((t) => key.startsWith(normalizeDayKey(t.day))) ??
    null
  )
}

export function slotsForDoctorOnDate(
  doctor: Pick<Doctor, 'profile_details' | 'available_times' | 'source'>,
  dateIso: string
): { slots: TimeSlot[]; dayTiming: PracticeTimingRow | null; hasWeeklySchedule: boolean } {
  const timings = getPracticeTimingsFromDoctor(doctor)
  const hasWeeklySchedule = timings.length > 0

  if (!dateIso) {
    return { slots: [], dayTiming: null, hasWeeklySchedule }
  }

  const dayTiming = findTimingForDate(timings, dateIso)
  if (dayTiming) {
    return {
      slots: generateTimeSlots(dayTiming.start, dayTiming.end, 30),
      dayTiming,
      hasWeeklySchedule,
    }
  }

  if (hasWeeklySchedule) {
    return { slots: [], dayTiming: null, hasWeeklySchedule }
  }

  const legacy = doctor.available_times as {
    start?: string
    end?: string
    practice_timings?: PracticeTimingRow[]
  } | null
  if (legacy?.start && legacy?.end && !legacy.practice_timings?.length) {
    return {
      slots: generateTimeSlots(legacy.start, legacy.end, 30),
      dayTiming: null,
      hasWeeklySchedule: false,
    }
  }

  if (doctor.source === 'marham') {
    return { slots: [], dayTiming: null, hasWeeklySchedule: false }
  }

  return {
    slots: generateTimeSlots('09:00', '17:00', 30),
    dayTiming: null,
    hasWeeklySchedule: false,
  }
}
