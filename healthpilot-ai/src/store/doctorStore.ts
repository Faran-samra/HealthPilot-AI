import { create } from 'zustand'
import type { Doctor } from '@/lib/database.types'

interface DoctorFilters {
  city: string
  specialty: string
  maxFee?: number
  availableToday: boolean
}

interface DoctorStore {
  doctors: Doctor[]
  selectedDoctor: Doctor | null
  filters: DoctorFilters
  loading: boolean
  setDoctors: (doctors: Doctor[]) => void
  setSelectedDoctor: (doctor: Doctor | null) => void
  setFilters: (filters: Partial<DoctorFilters>) => void
  setLoading: (loading: boolean) => void
}

export const useDoctorStore = create<DoctorStore>((set) => ({
  doctors: [],
  selectedDoctor: null,
  filters: {
    city: 'lahore',
    specialty: '',
    availableToday: false,
  },
  loading: false,

  setDoctors: (doctors) => set({ doctors }),
  setSelectedDoctor: (selectedDoctor) => set({ selectedDoctor }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setLoading: (loading) => set({ loading }),
}))
