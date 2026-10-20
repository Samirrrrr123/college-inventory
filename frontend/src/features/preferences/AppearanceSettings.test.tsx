import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';

describe('Interface preferences', () => {
  it('applies a dark theme and restores the theme and language after remount', async () => {
    const user = userEvent.setup();
    const app = renderApp('/profile');
    await user.click(screen.getByRole('radio', { name: 'Тёмная' }));
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument();
    app.unmount();
    renderApp('/profile');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses valid defaults when stored preferences are invalid', () => {
    localStorage.setItem('inventory.theme', 'unexpected');
    localStorage.setItem('inventory.language', 'unexpected');
    renderApp('/profile');
    expect(screen.getByRole('radio', { name: 'Системная' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(document.documentElement).toHaveAttribute('lang', 'ru');
  });
});
