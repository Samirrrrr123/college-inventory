import { Link, Navigate, Route, Routes } from 'react-router';
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
import { LiveLayout } from './LiveLayout';
import { CatalogEquipmentPage } from '../features/catalog/CatalogEquipmentPage';
import { CatalogDirectoriesPage } from '../features/catalog/CatalogDirectoriesPage';
import { LiveRequestsPage } from '../features/circulation/LiveRequestsPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { UsersPage } from '../features/users/UsersPage';
import { HistoryPage } from '../features/history/HistoryPage';

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
      <Route path="app" element={<LiveLayout />}>
        <Route index element={<Navigate to="equipment" replace />} />
        <Route path="equipment" element={<CatalogEquipmentPage />} />
        <Route path="requests" element={<LiveRequestsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/:id" element={<InventoryPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="movements" element={<HistoryPage kind="movements" />} />
        <Route path="audit" element={<HistoryPage kind="audit" />} />
        <Route path="rooms" element={<CatalogDirectoriesPage key="rooms" kind="rooms" />} />
        <Route
          path="categories"
          element={<CatalogDirectoriesPage key="categories" kind="categories" />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
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
