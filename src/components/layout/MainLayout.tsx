import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { EmergencyWidget } from './EmergencyWidget'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/authStore'
import { changeAppLanguage, type AppLanguage } from '@/i18n'
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime'

export function MainLayout() {
  const profile = useAuthStore((s) => s.profile)
  useSupabaseRealtime()

  useEffect(() => {
    if (profile?.preferred_language) {
      changeAppLanguage(profile.preferred_language as AppLanguage)
    }
  }, [profile?.preferred_language])

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="w-full">
        <Outlet />
      </main>
      <Footer />
      <EmergencyWidget />
      <Toaster richColors position="top-center" />
    </div>
  )
}
