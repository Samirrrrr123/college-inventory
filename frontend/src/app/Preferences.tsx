import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Language, Theme } from '../domain/types';
import { messages } from '../i18n/messages';
import type { MessageKey } from '../i18n/messages';

interface Preferences {
  language: Language;
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  t: (key: MessageKey) => string;
  date: (value: string) => string;
}

const PreferencesContext = createContext<Preferences | null>(null);

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() =>
    readPreference('inventory.language') === 'en' ? 'en' : 'ru',
  );
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readPreference('inventory.theme');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.lang = language;
    document.title = language === 'ru' ? 'Инвентарь' : 'Inventory';
    try {
      localStorage.setItem('inventory.theme', theme);
      localStorage.setItem('inventory.language', language);
    } catch {
      return;
    }
  }, [language, theme, resolvedTheme]);

  const value: Preferences = {
    language,
    theme,
    resolvedTheme,
    setLanguage,
    setTheme,
    t: (key) => messages[key][language === 'ru' ? 0 : 1],
    date: (value) =>
      new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
        day: 'numeric',
        month: 'long',
        timeZone: 'Europe/Moscow',
      }).format(new Date(value)),
  };

  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('PreferencesProvider is missing');
  return context;
}
