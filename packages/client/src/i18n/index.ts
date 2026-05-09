import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

/**
 * Resolve the initial language:
 * 1. User's persisted preference (localStorage)
 * 2. Browser/device locale (Req 18.3)
 * 3. Fallback: English
 */
function resolveInitialLanguage(): string {
  const supported = ['en', 'fr'];
  const persisted = localStorage.getItem('showup2move_lang');
  if (persisted && supported.includes(persisted)) return persisted;
  const browser = navigator.language.split('-')[0];
  if (supported.includes(browser)) return browser;
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: resolveInitialLanguage(),
  // Fall back to English for any untranslated string (Req 18.4)
  fallbackLng: 'en',
  interpolation: {
    // React already escapes values — no double-escaping needed
    escapeValue: false,
  },
});

export default i18n;
