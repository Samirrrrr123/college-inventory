import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PreferencesProvider } from '../app/Preferences';
import { DemoProvider } from '../demo/DemoProvider';
import { App } from '../app/App';

export function renderApp(path = '/') {
  return render(
    <PreferencesProvider>
      <DemoProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </DemoProvider>
    </PreferencesProvider>,
  );
}
