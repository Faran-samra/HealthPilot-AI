import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { changeAppLanguage, type AppLanguage } from '@/i18n'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const { profile, updateProfile, user } = useAuthStore()
  const current = i18n.language as AppLanguage

  const setLanguage = async (lang: AppLanguage) => {
    await changeAppLanguage(lang)
    if (user && profile?.preferred_language !== lang) {
      try {
        await updateProfile({ preferred_language: lang })
      } catch {
        // Language still switched locally
      }
    }
  }

  return (
    <div className={cn('flex items-center gap-1 rounded-lg border p-1', className)}>
      <Languages className="mx-1 size-3.5 text-muted-foreground" aria-hidden />
      <Button
        size="xs"
        variant={current === 'en' ? 'default' : 'ghost'}
        onClick={() => setLanguage('en')}
        aria-label={t('common.english')}
      >
        EN
      </Button>
      <Button
        size="xs"
        variant={current === 'ur' ? 'default' : 'ghost'}
        onClick={() => setLanguage('ur')}
        aria-label={t('common.urdu')}
      >
        اردو
      </Button>
    </div>
  )
}
