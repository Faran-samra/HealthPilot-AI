import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LANGUAGES = ['en', 'ur'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const saved = localStorage.getItem('healthpilot-lang') as AppLanguage | null

i18n.use(initReactI18next).init({
  resources: {},
  lng: saved ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

async function loadLanguage(lang: AppLanguage) {
  if (i18n.hasResourceBundle(lang, 'translation')) return

  const response = await fetch(`/locales/${lang}.json`)
  const translations = await response.json()
  i18n.addResourceBundle(lang, 'translation', translations, true, true)
}

export async function initI18n(initialLang?: AppLanguage) {
  const lang = initialLang ?? (saved as AppLanguage) ?? 'en'
  await Promise.all(SUPPORTED_LANGUAGES.map(loadLanguage))
  await i18n.changeLanguage(lang)
  applyDocumentLanguage(lang)
}

export function applyDocumentLanguage(lang: AppLanguage) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'
  localStorage.setItem('healthpilot-lang', lang)
}

export async function changeAppLanguage(lang: AppLanguage) {
  await loadLanguage(lang)
  await i18n.changeLanguage(lang)
  applyDocumentLanguage(lang)
}

export default i18n
