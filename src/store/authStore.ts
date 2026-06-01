import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/database.types'

interface SignUpData {
  email: string
  password: string
  fullName: string
  phone: string
  city: string
}

interface AuthStore {
  user: User | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (data: SignUpData) => Promise<void>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
  initialize: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await get().loadProfile()
  },

  signUp: async ({ email, password, fullName, phone, city }) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (!data.user) throw new Error('Registration failed')

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      phone,
      city,
    })

    if (profileError) throw profileError
    await get().loadProfile()
  },

  loadProfile: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      set({ user: null, profile: null, loading: false })
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    set({ user, profile: profile ?? null, loading: false })
  },

  initialize: async () => {
    if (get().initialized) return

    await get().loadProfile()

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await get().loadProfile()
      } else {
        set({ user: null, profile: null, loading: false })
      }
    })

    set({ initialized: true, loading: false })
  },

  updateProfile: async (updates) => {
    const { user } = get()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error
    set({ profile: data })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },
}))
