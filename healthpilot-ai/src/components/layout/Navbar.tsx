import { Link, useLocation } from 'react-router-dom'
import { Activity, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { t } = useTranslation()
  const { user, signOut } = useAuthStore()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { href: '/symptom-checker', label: t('nav.symptomChecker') },
    { href: '/doctors', label: t('nav.findDoctors') },
    { href: '/health-info', label: t('nav.healthInfo') },
    { href: '/appointments', label: t('nav.appointments'), auth: true },
    { href: '/dashboard', label: t('nav.dashboard'), auth: true },
  ]

  const visibleLinks = navLinks.filter((link) => !link.auth || user)

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
          <Activity className="size-6" />
          <span>{t('common.appName')}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
                location.pathname === link.href && 'bg-muted text-primary'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link to="/profile">
                <Button variant="ghost" size="sm">
                  {t('common.profile')}
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                {t('common.signOut')}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {t('common.login')}
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">{t('common.getStarted')}</Button>
              </Link>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="border-t px-4 py-3 md:hidden">
          <div className="mb-3">
            <LanguageSwitcher className="w-full justify-center" />
          </div>
          <nav className="flex flex-col gap-1">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3">
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      {t('common.profile')}
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => signOut()}>
                    {t('common.signOut')}
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full">
                      {t('common.login')}
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full">{t('common.getStarted')}</Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
