import { create } from 'zustand'
import type { DirectoryDoctor } from '@/types/doctorDirectory'

const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_ENTRIES = 36

type CacheEntry = {
  doctors: DirectoryDoctor[]
  at: number
}

interface DoctorsDirectoryStore {
  entries: Record<string, CacheEntry>
  peek: (key: string) => DirectoryDoctor[] | null
  put: (key: string, doctors: DirectoryDoctor[]) => void
}

export const useDoctorsDirectoryStore = create<DoctorsDirectoryStore>((set, get) => ({
  entries: {},

  peek(key) {
    const entry = get().entries[key]
    if (!entry) return null
    if (Date.now() - entry.at > CACHE_TTL_MS) return null
    return entry.doctors
  },

  put(key, doctors) {
    set((state) => {
      const entries: Record<string, CacheEntry> = {
        ...state.entries,
        [key]: { doctors, at: Date.now() },
      }
      const keys = Object.keys(entries)
      if (keys.length > MAX_ENTRIES) {
        const oldest = keys.sort((a, b) => entries[a].at - entries[b].at)[0]
        delete entries[oldest]
      }
      return { entries }
    })
  },
}))
