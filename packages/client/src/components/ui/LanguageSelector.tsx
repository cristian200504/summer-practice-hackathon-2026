import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

/**
 * Language selector dropdown.
 *
 * - Persists the selected language to localStorage so it survives page reloads.
 * - Falls back to English for any untranslated string (configured in i18n init).
 * - Accessible via a labelled <select> element.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */
export default function LanguageSelector() {
  const { i18n, t } = useTranslation();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const lang = e.target.value;
    void i18n.changeLanguage(lang);
    localStorage.setItem('showup2move_lang', lang);
  }

  return (
    <div className="lang-selector">
      <label htmlFor="language-select" className="lang-selector__label">
        {t('settings.language', 'Language')}
      </label>
      <select
        id="language-select"
        className="lang-selector__select"
        value={i18n.language.split('-')[0]}
        onChange={handleChange}
        aria-label={t('settings.language', 'Language')}
      >
        {SUPPORTED_LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
