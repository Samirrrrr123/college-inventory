import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../../api/client';
import type { Dashboard } from '../../api/dashboard';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { EmptyState, PageHeader, Status } from '../../components/Common';
import type { RequestStatus } from '../../domain/types';
import { ApiFeedback } from '../catalog/ApiFeedback';

export function DashboardPage() {
  const { t, date, language } = usePreferences();
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    revision: number;
    data: Dashboard | null;
    error: unknown;
  } | null>(null);
  useEffect(() => {
    let active = true;
    api<{ data: Dashboard }>('/dashboard')
      .then(({ data }) => {
        if (active) setState({ revision, data, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          navigate('/login', { replace: true });
        else setState({ revision, data: null, error });
      });
    return () => {
      active = false;
    };
  }, [revision, navigate]);
  const loading = state?.revision !== revision;
  const data = loading ? null : state.data;
  const error = loading ? null : state.error;
  const statuses = [
    ['available', 'available', 'available'],
    ['issued', 'issued', 'issued'],
    ['repair', 'maintenance', 'maintenance'],
    ['written_off', 'writtenOff', 'written_off'],
  ] as const;
  return (
    <>
      <PageHeader title={t('overview')} subtitle={t('dashboardSubtitle')}>
        <Button variant="secondary" disabled={loading} onClick={() => setRevision(revision + 1)}>
          {t('refreshList')}
        </Button>
        <Link className="button button--primary" to="/app/requests">
          {t('requests')}
        </Link>
      </PageHeader>
      <ApiFeedback loading={loading} error={error} onRetry={() => setRevision(revision + 1)} />
      {data && (
        <>
          <p className="muted small-text">
            {t(data.scope === 'own' ? 'dashboardOwn' : 'dashboardAll')}
          </p>
          <section className="stats-strip" aria-label={t('dashboardSummary')}>
            <div className="stat">
              <strong>{data.totalEquipment}</strong>
              <span>{t('totalEquipment')}</span>
              <small>
                {data.rooms} · {t('rooms')}
              </small>
            </div>
            <div className="stat">
              <strong>{data.equipment.available}</strong>
              <span>{t('available')}</span>
              <small>{t('availableNote')}</small>
            </div>
            <div className="stat">
              <strong>{data.activeLoans}</strong>
              <span>{t('activeLoans')}</span>
              <small className={data.overdueLoans ? 'danger-text' : ''}>
                {data.overdueLoans} · {t('overdue')}
              </small>
            </div>
            <div className="stat">
              <strong>{data.pendingRequests}</strong>
              <span>{t('newRequests')}</span>
              <small>{t('pendingRequests')}</small>
            </div>
          </section>
          <div className="overview-grid">
            <section className="panel">
              <h2>{t('overdue')}</h2>
              {data.overdue.length ? (
                <>
                  <div className="warning-strip">
                    {data.overdueLoans} · {t('overdueNote')}
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
                        {data.overdue.map((loan) => (
                          <tr key={loan.id}>
                            <td data-label={t('equipment')}>
                              <strong>
                                {loan.items.map((item) => item.equipment.name).join(', ')}
                              </strong>
                              <small>№ {loan.number}</small>
                            </td>
                            <td data-label={t('borrower')}>{loan.recipient.name}</td>
                            <td data-label={t('returnBy')} className="danger-text">
                              <time dateTime={loan.dueAt}>{date(loan.dueAt)}</time>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyState />
              )}
              <div className="section-heading">
                <h2>{t('latestRequests')}</h2>
                <Link className="text-link" to="/app/requests">
                  {t('allRequests')} →
                </Link>
              </div>
              {data.latestRequests.length ? (
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
                      {data.latestRequests.map((request) => (
                        <tr key={request.id}>
                          <td data-label={t('equipment')}>
                            <strong>
                              {request.items.map((item) => item.equipment.name).join(', ')}
                            </strong>
                            <small>
                              № {request.number} · {date(request.createdAt)}
                            </small>
                          </td>
                          <td data-label={t('teacher')}>{request.requester.name}</td>
                          <td data-label={t('status')}>
                            <Status value={request.status.toUpperCase() as RequestStatus} />
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
                {data.totalEquipment} · {t('totalEquipment')}
              </p>
              <div className="status-chart" role="img" aria-label={t('fundStatus')}>
                {statuses.map(([status, label, className]) => (
                  <div className={`chart-row chart-row--${className}`} key={status}>
                    <div>
                      <span>{t(label)}</span>
                      <strong>{data.equipment[status]}</strong>
                    </div>
                    <progress
                      value={data.equipment[status]}
                      max={Math.max(1, data.totalEquipment)}
                      aria-label={t(label)}
                    >
                      {data.equipment[status]}
                    </progress>
                  </div>
                ))}
              </div>
              <p className="muted small-text">
                {t('dashboardUpdated')}{' '}
                <time dateTime={data.generatedAt}>
                  {new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Europe/Moscow',
                  }).format(new Date(data.generatedAt))}
                </time>
              </p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
