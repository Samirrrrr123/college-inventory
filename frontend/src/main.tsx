import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/inter';
import { PreferencesProvider } from './app/Preferences';
import { DemoProvider } from './demo/DemoProvider';
import { App } from './app/App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <DemoProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DemoProvider>
    </PreferencesProvider>
  </StrictMode>,
);
