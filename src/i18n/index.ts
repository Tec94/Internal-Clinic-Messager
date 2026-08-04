import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { vi } from './locales/vi'

const savedLocale = globalThis.localStorage?.getItem('clinic-locale')
const initialLocale = savedLocale ?? 'vi-VN'

void i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: en },
    'vi-VN': { translation: vi },
  },
  lng: initialLocale,
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
  showSupportNotice: false,
})

document.documentElement.lang = initialLocale

i18n.on('languageChanged', (locale) => {
  localStorage.setItem('clinic-locale', locale)
  document.documentElement.lang = locale
})

export default i18n
