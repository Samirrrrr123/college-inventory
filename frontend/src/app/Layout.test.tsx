import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';

describe('Demo navigation', () => {
  it('starts with Samir and hides administration for the teacher preview', async () => {
    const user = userEvent.setup();
    renderApp('/administration');
    expect(screen.getByRole('link', { name: 'Администрирование' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Посмотреть как'), 'elena');
    expect(screen.queryByRole('link', { name: 'Администрирование' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Раздел недоступен для этой роли' }),
    ).toBeInTheDocument();
  });

  it('shows only the selected teacher requests in the demo list', async () => {
    const user = userEvent.setup();
    renderApp('/requests');
    await user.selectOptions(screen.getByLabelText('Посмотреть как'), 'elena');
    expect(screen.getByText('ЗЯ-0016')).toBeInTheDocument();
    expect(screen.queryByText('ЗЯ-0018')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Рассмотреть →' })).not.toBeInTheDocument();
  });
});
