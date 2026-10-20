import { Link } from 'react-router';
import { useState } from 'react';
import { useDemo } from '../demo/DemoProvider';
import { usePreferences } from '../app/Preferences';
import { EmptyState, PageHeader, Status } from '../components/Common';
import type { EquipmentStatus } from '../domain/types';

export function OverviewPage() {
  const { t, date } = usePreferences();
  const { equipment, requests, loans, people, rooms, movements, person } = useDemo();
  const [now] = useState(() => Date.now());
  const ownLoans = loans.filter((item) => person.role !== 'TEACHER' || item.personId === person.id);
  const ownRequests = requests.filter(
    (item) => person.role !== 'TEACHER' || item.personId === person.id,
  );
  const overdue = ownLoans.filter(
    (item) => !item.returnedAt && new Date(`${item.dueDate}T23:59:59+03:00`).getTime() < now,
  );
  const statuses: { value: EquipmentStatus; label: string }[] = [
    { value: 'AVAILABLE', label: t('available') },
    { value: 'ISSUED', label: t('issued') },
    { value: 'MAINTENANCE', label: t('maintenance') },
    { value: 'WRITTEN_OFF', label: t('writtenOff') },
  ];
  const stats = [
    {
      number: equipment.length,
      label: t('totalEquipment'),
      note: `${rooms.length} · ${t('rooms')}`,
    },
    {
      number: equipment.filter((item) => item.status === 'AVAILABLE').length,
      label: t('available'),
      note: t('availableNote'),
    },
    {
      number: ownLoans.filter((item) => !item.returnedAt).length,
      label: t('activeLoans'),
      note: `${overdue.length} · ${t('overdue')}`,
    },
    {
      number: ownRequests.filter((item) => item.status === 'PENDING').length,
      label: t('newRequests'),
      note: t('pendingRequests'),
    },
  ];
  const latestMovement = movements[0];
  return (
    <>
      <PageHeader title={t('overview')} subtitle={t('overviewSubtitle')}>
        <Link className="button button--primary" to="/requests">
          {t(person.role === 'TEACHER' ? 'newRequest' : 'requests')}
        </Link>
      </PageHeader>
      <section className="stats-strip">
        {stats.map((item, index) => (
          <div className="stat" key={item.label}>
            <strong>{item.number}</strong>
            <span>{item.label}</span>
            <small className={index === 2 && overdue.length ? 'danger-text' : ''}>
              {item.note}
            </small>
          </div>
        ))}
      </section>
      <div className="overview-grid">
        <section className="panel">
          <h2>{t('overdue')}</h2>
          {overdue.length ? (
            <>
              <div className="warning-strip">
                {overdue.length} · {t('overdueNote')}
              </div>
              <div className="table-wrap">
                <table className="data-table compact-table">
                  <thead>
                    <tr>
                      <th>{t('equipment')}</th>
                      <th>{t('borrower')}</th>
                      <th>{t('returnBy')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.slice(0, 3).map((loan) => {
                      const items = equipment.filter((item) => loan.equipmentIds.includes(item.id));
                      return (
                        <tr key={loan.id}>
                          <td data-label={t('equipment')}>
                            <strong>{items.map((item) => item.name).join(', ')}</strong>
                            <small>{loan.number}</small>
                          </td>
                          <td data-label={t('borrower')}>
                            {people.find((item) => item.id === loan.personId)?.name}
                          </td>
                          <td data-label={t('returnBy')} className="danger-text">
                            {date(loan.dueDate)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState />
          )}
          <div className="section-heading">
            <h2>{t('latestRequests')}</h2>
            <Link className="text-link" to="/requests">
              {t('allRequests')} →
            </Link>
          </div>
          {ownRequests.length ? (
            <div className="table-wrap">
              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>{t('equipment')}</th>
                    <th>{t('teacher')}</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ownRequests.slice(0, 3).map((request) => (
                    <tr key={request.id}>
                      <td data-label={t('equipment')}>
                        <strong>
                          {equipment
                            .filter((item) => request.equipmentIds.includes(item.id))
                            .map((item) => item.name)
                            .join(', ')}
                        </strong>
                        <small>
                          {request.number} · {date(request.createdAt)}
                        </small>
                      </td>
                      <td data-label={t('teacher')}>
                        {people.find((item) => item.id === request.personId)?.name}
                      </td>
                      <td data-label={t('status')}>
                        <Status value={request.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
        <section className="panel fund-panel">
          <h2>{t('fundStatus')}</h2>
          <p className="muted small-text">
            {equipment.length} {t('totalEquipment')}
          </p>
          <div className="status-chart" role="img" aria-label={t('fundStatus')}>
            {statuses.map(({ value, label }) => {
              const count = equipment.filter((item) => item.status === value).length;
              return (
                <div className={`chart-row chart-row--${value.toLowerCase()}`} key={value}>
                  <div>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                  <progress value={count} max={Math.max(1, equipment.length)} aria-label={label}>
                    {count}
                  </progress>
                </div>
              );
            })}
          </div>
          <div className="movement-summary">
            <p className="muted small-text">{t('latestMovement')}</p>
            {latestMovement ? (
              <>
                <strong>
                  {equipment.find((item) => item.id === latestMovement.equipmentId)?.name}
                </strong>
                <p>
                  {rooms.find((item) => item.id === latestMovement.fromRoomId)?.number ??
                    latestMovement.fromRoomId}{' '}
                  →{' '}
                  {rooms.find((item) => item.id === latestMovement.toRoomId)?.number ??
                    latestMovement.toRoomId}
                </p>
                <small>{date(latestMovement.createdAt)}</small>
              </>
            ) : (
              <p>{t('noMovements')}</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
