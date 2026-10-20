import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import type { Theme } from '../../domain/types';

export function AppearanceSettings() {
  const { t, theme, setTheme, language, setLanguage } = usePreferences();
  const themes: Theme[] = ['light', 'dark', 'system'];

  return (
    <section className="panel preferences-panel">
      <h2>{t('interfaceSettings')}</h2>
      <fieldset className="theme-fieldset">
        <legend>{t('appearance')}</legend>
        <div className="theme-options">
          {themes.map((value) => (
            <label className={`theme-option ${theme === value ? 'selected' : ''}`} key={value}>
              <input
                type="radio"
                name="appearance"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
              />
              <Icon
                name={value === 'light' ? 'sun' : value === 'dark' ? 'moon' : 'equipment'}
                active={theme === value}
              />
              <span>{t(value)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="language-options">
        <p>{t('language')}</p>
        <div>
          <Button
            variant={language === 'ru' ? 'primary' : 'secondary'}
            aria-pressed={language === 'ru'}
            onClick={() => setLanguage('ru')}
          >
            Русский
          </Button>
          <Button
            variant={language === 'en' ? 'primary' : 'secondary'}
            aria-pressed={language === 'en'}
            onClick={() => setLanguage('en')}
          >
            English
          </Button>
        </div>
      </div>
      <p className="muted small-text">{t('savedOnDevice')}</p>
    </section>
  );
}
