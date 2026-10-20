import { Link, Route, Routes } from 'react-router';
import { Layout } from './Layout';
import { OverviewPage } from '../pages/OverviewPage';
import { EquipmentPage } from '../features/equipment/EquipmentPage';
import { RequestsPage } from '../pages/RequestsPage';
import { RoomsPage } from '../pages/RoomsPage';
import { AdministrationPage } from '../pages/AdministrationPage';
import { ProfilePage } from '../pages/ProfilePage';
import { usePreferences } from './Preferences';
import { AuthLayout } from '../features/auth/AuthLayout';
import { AuthPage } from '../features/auth/AuthPage';
import { AccountPage } from '../features/auth/AccountPage';

function NotFoundPage() {
  const { t } = usePreferences();
  return (
    <section className="panel empty-state">
      <h1>{t('notFound')}</h1>
      <Link className="button button--primary" to="/">
        {t('goHome')}
      </Link>
    </section>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<AuthPage key="login" mode="login" />} />
        <Route path="register" element={<AuthPage key="register" mode="register" />} />
        <Route path="forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
        <Route path="reset-password" element={<AuthPage key="reset" mode="reset" />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="administration" element={<AdministrationPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
