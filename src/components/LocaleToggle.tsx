import { type Locale, isEnglish } from '../i18n';

interface LocaleToggleProps {
  locale: Locale;
  toggleHref: string;
  otherLabel: string;
  currentLabel: string;
  switchLanguage: string;
}

function FlagIcon({ locale }: { locale: Locale }) {
  if (isEnglish(locale)) {
    return (
      <svg viewBox="0 0 24 16" width="20" height="13" aria-hidden="true">
        <rect width="24" height="16" fill="#b22234" />
        <path
          d="M0 1.23h24M0 3.69h24M0 6.15h24M0 8.62h24M0 11.08h24M0 13.54h24"
          stroke="#fff"
          strokeWidth="1.23"
        />
        <rect width="9.6" height="8.62" fill="#3c3b6e" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 16" width="20" height="13" aria-hidden="true">
      <rect width="24" height="16" fill="#009b3a" />
      <polygon points="12,1.5 22,14.5 2,14.5" fill="#ffdf00" />
      <circle cx="12" cy="8" r="3.2" fill="#002776" />
    </svg>
  );
}

export function LocaleToggle({
  locale,
  toggleHref,
  otherLabel,
  currentLabel,
  switchLanguage,
}: LocaleToggleProps) {
  return (
    <a
      className="locale-toggle"
      href={toggleHref}
      title={`${switchLanguage}: ${otherLabel}`}
      aria-label={`${switchLanguage}: ${otherLabel}`}
    >
      <FlagIcon locale={locale} />
      <span>{currentLabel}</span>
    </a>
  );
}
