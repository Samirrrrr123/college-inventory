import { Link, Outlet, useLocation } from 'react-router';
import { usePreferences } from '../../app/Preferences';

export function AuthLayout() {
  const { t, language, setLanguage, resolvedTheme, setTheme } = usePreferences();
  const { pathname } = useLocation();

  return (
    <div className="auth-layout">
      <a className="skip-link" href="#auth-content">
        {t('skipContent')}
      </a>
      <aside className="auth-branding">
        <Link className="auth-brand" to="/login">
          {t('brand')}
        </Link>
        <div className="auth-story">
          <img src="/icons/bf7ed.svg" width="100" height="100" alt="" aria-hidden="true" />
          <h2>{t('collegeEquipment')}</h2>
          <p>{t('authDescription')}</p>
        </div>
        <p className="auth-authors">{t('projectAuthors')}</p>
      </aside>
      <main
        id="auth-content"
        className={`auth-main ${pathname === '/login' ? 'auth-main--login' : 'auth-main--card'}`}
      >
        <div className="auth-content">
          <Outlet />
          <div className="auth-preferences">
            <button
              type="button"
              onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
              aria-label={t('language')}
            >
              Русский / English
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
              aria-label={t('appearance')}
            >
              {t('light')} / {t('dark')}
            </button>
          </div>
          {pathname !== '/account' && (
            <div className="auth-demo-note">
              <p>{t('authPreviewNote')}</p>
              <Link to="/">{t('openDemo')} →</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
