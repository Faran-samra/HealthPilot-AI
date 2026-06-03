import { create } from 'zustand'
import type { Doctor } from '@/lib/database.types'
import { getDoctorById } from '@/services/doctorService'
import type { DirectoryDoctor } from '@/types/doctorDirectory'

const TTL_MS = 20 * 60 * 1000

type Entry = { doctor: Doctor; at: number }

const inflight = new Set<string>()

/** Map list card data to a partial Doctor row for instant profile shell. */
export function directoryDoctorToDoctorPreview(d: DirectoryDoctor): Doctor {
  return {
    id: d.id,
    full_name: d.full_name,
    specialty: d.specialty,
    specialty_slug: d.specialty_slug,
    qualification: d.qualification,
    experience_years: d.experience_years,
    hospital_name: d.hospital_name,
    clinic_name: d.clinic_name,
    address: d.address,
    city: d.city,
    city_slug: d.city_slug,
    province: d.province,
    area: d.area,
    latitude: d.latitude,
    longitude: d.longitude,
    phone: d.phone,
    whatsapp: d.whatsapp,
    consultation_fee: d.consultation_fee,
    available_days: null,
    available_times: null,
    languages: d.languages,
    rating: d.rating,
    total_reviews: d.total_reviews,
    profile_image_url: d.profile_image_url,
    is_verified: d.is_verified,
    is_active: d.is_active,
    pmdc_number: d.pmdc_number,
    accepts_online: d.accepts_online,
    gender: d.gender,
    source: d.source,
    source_url: d.source_url,
    verification_status: d.verification_status,
    publication_status: 'published',
    profile_details: null,
    created_at: '',
    updated_at: '',
    location: null,
    source_count: null,
    claimed_by: null,
    claimed_at: null,
  } as Doctor
}

interface DoctorProfileStore {
  byId: Record<string, Entry>
  peek: (id: string) => Doctor | null
  put: (id: string, doctor: Doctor) => void
  prefetch: (id: string) => void
}

export const useDoctorProfileStore = create<DoctorProfileStore>((set, get) => ({
  byId: {},

  peek(id) {
    const entry = get().byId[id]
    if (!entry) return null
    if (Date.now() - entry.at > TTL_MS) return null
    return entry.doctor
  },

  put(id, doctor) {
    set((state) => ({
      byId: { ...state.byId, [id]: { doctor, at: Date.now() } },
    }))
  },

  prefetch(id) {
    if (get().peek(id) || inflight.has(id)) return
    inflight.add(id)
    getDoctorById(id)
      .then((doctor) => {
        if (doctor) get().put(id, doctor)
      })
      .finally(() => {
        inflight.delete(id)
      })
  },
}))

export type DoctorDetailLocationState = {
  directoryDoctor?: DirectoryDoctor
}
