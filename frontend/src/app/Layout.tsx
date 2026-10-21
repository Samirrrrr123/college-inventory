import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { usePreferences } from './Preferences';
import { useDemo } from '../demo/DemoProvider';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import type { MessageKey } from '../i18n/messages';
import type { Person } from '../domain/types';

const navigation: { path: string; label: MessageKey; icon: IconName; adminOnly?: boolean }[] = [
  { path: '/', label: 'overview', icon: 'overview' },
  { path: '/equipment', label: 'equipment', icon: 'equipment' },
  { path: '/requests', label: 'requests', icon: 'requests' },
  { path: '/rooms', label: 'rooms', icon: 'rooms' },
  { path: '/administration', label: 'administration', icon: 'administration', adminOnly: true },
  { path: '/profile', label: 'profile', icon: 'profile' },
];

export function Layout({ livePerson }: { livePerson?: Person }) {
  const { t, language, setLanguage, theme, setTheme, date } = usePreferences();
  const { person: demoPerson, setPersonId, people } = useDemo();
  const person = livePerson ?? demoPerson;
  const home = livePerson ? '/app/equipment' : '/';
  const profile = livePerson ? '/account' : '/profile';
  const items = livePerson
    ? [
        { path: '/app/equipment', label: 'equipment' as const, icon: 'equipment' as const },
        { path: '/app/requests', label: 'requests' as const, icon: 'requests' as const },
        ...(person.role !== 'TEACHER'
          ? [{ path: '/app/inventory', label: 'inventory' as const, icon: 'rooms' as const }]
          : []),
        { path: '/app/rooms', label: 'rooms' as const, icon: 'rooms' as const },
        { path: '/app/categories', label: 'categories' as const, icon: 'administration' as const },
        ...(person.role === 'ADMIN'
          ? [{ path: '/app/users', label: 'users' as const, icon: 'administration' as const }]
          : []),
        { path: '/account', label: 'profile' as const, icon: 'profile' as const },
      ]
    : navigation.filter((item) => !item.adminOnly || person.role === 'ADMIN');
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const roleLabel =
    person.role === 'ADMIN'
      ? t('admin')
      : person.role === 'LAB_ASSISTANT'
        ? t('assistant')
        : t('teacher');

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        {t('skipContent')}
      </a>
      <header className="mobile-header">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t('menu')}
          aria-expanded={menuOpen}
        >
          <Icon name="menu" />
        </button>
        <Link to={home} className="brand">
          {t('brand')}
        </Link>
        <Link to={profile} aria-label={t('profile')}>
          <Icon name="mobileUser" />
        </Link>
      </header>
      {menuOpen && (
        <button
          className="menu-backdrop"
          type="button"
          aria-label={t('closeMenu')}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <Link to={home} className="brand" onClick={() => setMenuOpen(false)}>
            {t('brand')}
          </Link>
          <p>{t('collegeEquipment')}</p>
        </div>
        <nav aria-label={t('menu')}>
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setMenuOpen(false)}
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} active={isActive} />
                  <span>{t(item.label)}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account">
          <strong>{person.name}</strong>
          <span>{roleLabel}</span>
          <Link className="sidebar-login" to={livePerson ? '/account' : '/login'}>
            {t(livePerson ? 'accountTitle' : 'signInTitle')} →
          </Link>
          <div className="sidebar-preferences">
            <button
              type="button"
              onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
              aria-label={t('language')}
            >
              {language.toUpperCase()} / {language === 'ru' ? 'EN' : 'RU'}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={t('appearance')}
            >
              ◐
            </button>
          </div>
        </div>
      </aside>
      <main id="main-content" className="main-content" key={location.pathname}>
        <div className="context-row">
          <span>{t('context')}</span>
          <time dateTime={new Date().toISOString()}>{date(new Date().toISOString())}</time>
        </div>
        <Outlet />
        <footer className="demo-bar">
          <div>
            <strong>{t(livePerson ? 'liveCatalog' : 'demo')}</strong>
            <span>{t(livePerson ? 'liveCatalogNote' : 'demoNote')}</span>
          </div>
          {livePerson ? (
            <Link to="/">{t('openDemo')} →</Link>
          ) : (
            <label>
              {t('demoRole')}
              <select value={person.id} onChange={(event) => setPersonId(event.target.value)}>
                {people
                  .filter((item) => !item.blocked)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </footer>
      </main>
    </div>
  );
}
