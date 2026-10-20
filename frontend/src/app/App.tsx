import { Link, Route, Routes } from 'react-router';
import { Layout } from './Layout';
import { OverviewPage } from '../pages/OverviewPage';
import { EquipmentPage } from '../features/equipment/EquipmentPage';
import { RequestsPage } from '../pages/RequestsPage';
import { RoomsPage } from '../pages/RoomsPage';
import { AdministrationPage } from '../pages/AdministrationPage';
import { ProfilePage } from '../pages/ProfilePage';
import { usePreferences } from './Preferences';

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
