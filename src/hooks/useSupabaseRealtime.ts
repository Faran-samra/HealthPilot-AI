import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useSupabaseRealtime() {
  const { user } = useAuthStore()
  const { t } = useTranslation()

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`appointments-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status
          const oldStatus = (payload.old as { status?: string }).status

          if (newStatus === oldStatus) return

          if (newStatus === 'confirmed') {
            toast.success(t('dashboard.notifConfirmed'))
          } else if (newStatus === 'cancelled') {
            toast.info(t('dashboard.notifCancelled'))
          } else if (newStatus === 'completed') {
            toast.success(t('dashboard.notifCompleted'))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, t])
}
