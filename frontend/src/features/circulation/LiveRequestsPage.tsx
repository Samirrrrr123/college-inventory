import { useEffect, useState } from 'react';
import { queryString } from '../../api/catalog';
import type { LoanRecord, RequestRecord } from '../../api/circulation';
import { useCurrentAccount } from '../../app/CurrentAccount';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Input, Select } from '../../components/Fields';
import { EmptyState, Notice, PageHeader, Pagination, Status, Tabs } from '../../components/Common';
import { ApiFeedback } from '../catalog/ApiFeedback';
import { useApiList } from '../catalog/useApiList';
import { useDebouncedValue } from '../catalog/useDebouncedValue';
import { LiveActionDialog, LiveIssueForm, LiveRequestForm } from './CirculationForms';
import type { CirculationAction } from './CirculationForms';

export function LiveRequestsPage() {
  const { t, date } = usePreferences();
  const account = useCurrentAccount();
  const staff = account.role !== 'teacher';
  const [tab, setTab] = useState<'requests' | 'loans' | 'returns'>('requests');
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [issue, setIssue] = useState<RequestRecord | 'direct' | null>(null);
  const [action, setAction] = useState<CirculationAction | null>(null);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const requests = tab === 'requests';
  const path = `/${requests ? 'requests' : 'loans'}?${queryString({ search: term, page, pageSize: 7, sort, order, status: requests ? status : tab === 'returns' ? 'returned' : status === 'overdue' ? 'overdue' : 'active' })}`;
  const list = useApiList<RequestRecord | LoanRecord>(path, revision);
  function saved() {
    setCreating(false);
    setIssue(null);
    setAction(null);
    setRevision((value) => value + 1);
    setNotice(t('liveSaved'));
  }
  function reset() {
    setSearch('');
    setStatus('');
    setPage(1);
  }
  function review(item: RequestRecord, decision: 'approve' | 'reject' | 'cancel') {
    const label = t(
      decision === 'approve' ? 'approve' : decision === 'reject' ? 'reject' : 'cancelRequest',
    );
    setAction({
      title: label,
      label,
      path: `/requests/${item.id}/${decision}`,
      description: `${t('requestNumber')} №${item.number} · ${item.requester.name} · ${item.items.map((entry) => entry.equipment.name).join(', ')}`,
      withNote: decision !== 'cancel',
    });
  }
  return (
    <>
      <PageHeader title={t('requests')} subtitle={t('requestsSubtitle')}>
        <Button onClick={() => setCreating(true)}>{t('newRequest')}</Button>
        {staff && (
          <Button variant="secondary" onClick={() => setIssue('direct')}>
            {t('directIssue')}
          </Button>
        )}
      </PageHeader>
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab(value);
          setStatus('');
          setPage(1);
          setSort(value === 'requests' ? 'createdAt' : 'issuedAt');
        }}
        items={[
          { value: 'requests', label: t('requestList') },
          { value: 'loans', label: t('activeLoans') },
          { value: 'returns', label: t('returns') },
        ]}
      />
      <div className="filters directory-filters">
        <Input
          label={t('search')}
          placeholder={t('requestSearch')}
          value={search}
          maxLength={200}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        {tab !== 'returns' && (
          <Select
            label={t('status')}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('allStatuses')}</option>
            {requests ? (
              <>
                <option value="pending">{t('pending')}</option>
                <option value="approved">{t('approved')}</option>
                <option value="rejected">{t('rejected')}</option>
                <option value="cancelled">{t('cancelled')}</option>
              </>
            ) : (
              <option value="overdue">{t('overdue')}</option>
            )}
          </Select>
        )}
        <Select
          label={t('sortBy')}
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
        >
          <option value={requests ? 'createdAt' : 'issuedAt'}>{t('created')}</option>
          <option value="number">{t('number')}</option>
          {!requests && <option value="dueAt">{t('returnBy')}</option>}
        </Select>
      </div>
      <section className="panel catalog-panel" aria-busy={list.loading}>
        <div className="section-heading">
          <div className="heading-inline">
            <h2>{t(requests ? 'requestList' : tab === 'loans' ? 'activeLoans' : 'returns')}</h2>
            {list.result && <span className="count-label">{list.result.total}</span>}
          </div>
          <div className="row-actions">
            <Button
              variant="secondary"
              aria-label={t('sortDirection')}
              onClick={() => {
                setOrder(order === 'asc' ? 'desc' : 'asc');
                setPage(1);
              }}
            >
              {order === 'asc' ? '↑' : '↓'}
            </Button>
            <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>
              {t('refreshList')}
            </Button>
          </div>
        </div>
        <ApiFeedback
          loading={list.loading}
          error={list.error}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {!list.loading &&
          !list.error &&
          list.result &&
          (list.result.data.length ? (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('number')}</th>
                      <th>{t('equipment')}</th>
                      <th>{t('borrower')}</th>
                      <th>{t(requests ? 'purpose' : 'returnBy')}</th>
                      <th>{t('status')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.result.data.map((entry) => {
                      if ('requester' in entry)
                        return (
                          <tr key={entry.id}>
                            <td data-label={t('number')}>
                              №{entry.number}
                              <small>{date(entry.createdAt)}</small>
                            </td>
                            <td data-label={t('equipment')}>
                              {entry.items.map((item) => (
                                <div key={item.equipmentId}>
                                  <strong>{item.equipment.name}</strong>
                                  <small>{item.equipment.inventoryNumber}</small>
                                </div>
                              ))}
                            </td>
                            <td data-label={t('borrower')}>{entry.requester.name}</td>
                            <td data-label={t('purpose')}>
                              {entry.purpose}
                              {entry.decisionNote && <small>{entry.decisionNote}</small>}
                            </td>
                            <td data-label={t('status')}>
                              <Status
                                value={
                                  entry.status.toUpperCase() as
                                    'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
                                }
                              />
                              {entry.loan && (
                                <small>{t(entry.loan.returnedAt ? 'returned' : 'issued')}</small>
                              )}
                            </td>
                            <td data-label={t('actions')}>
                              <div className="row-actions">
                                {staff && entry.status === 'pending' && (
                                  <>
                                    <Button variant="text" onClick={() => review(entry, 'approve')}>
                                      {t('approve')}
                                    </Button>
                                    <Button variant="text" onClick={() => review(entry, 'reject')}>
                                      {t('reject')}
                                    </Button>
                                  </>
                                )}
                                {staff && entry.status === 'approved' && !entry.loan && (
                                  <Button variant="text" onClick={() => setIssue(entry)}>
                                    {t('issue')}
                                  </Button>
                                )}
                                {!entry.loan && ['pending', 'approved'].includes(entry.status) && (
                                  <Button variant="text" onClick={() => review(entry, 'cancel')}>
                                    {t('cancelRequest')}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      const overdue = !entry.returnedAt && new Date(entry.dueAt).getTime() < now;
                      return (
                        <tr key={entry.id}>
                          <td data-label={t('number')}>
                            №{entry.number}
                            <small>{date(entry.issuedAt)}</small>
                          </td>
                          <td data-label={t('equipment')}>
                            {entry.items.map((item) => (
                              <div key={item.equipmentId}>
                                <strong>{item.equipment.name}</strong>
                                <small>{item.equipment.inventoryNumber}</small>
                              </div>
                            ))}
                          </td>
                          <td data-label={t('borrower')}>{entry.recipient.name}</td>
                          <td data-label={t('returnBy')}>{date(entry.dueAt)}</td>
                          <td data-label={t('status')}>
                            <span
                              className={`badge badge--${entry.returnedAt ? 'available' : overdue ? 'rejected' : 'issued'}`}
                            >
                              {t(entry.returnedAt ? 'returned' : overdue ? 'overdue' : 'issued')}
                            </span>
                            {entry.returnedAt && <small>{date(entry.returnedAt)}</small>}
                          </td>
                          <td data-label={t('actions')}>
                            {staff && !entry.returnedAt && (
                              <Button
                                variant="text"
                                onClick={() =>
                                  setAction({
                                    title: t('returnTitle'),
                                    label: t('returnEquipment'),
                                    path: `/loans/${entry.id}/return`,
                                    description: `${t('returnWholeSet')} ${entry.items.map((item) => item.equipment.name).join(', ')}`,
                                  })
                                }
                              >
                                {t('returnEquipment')}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={7} total={list.result.total} onChange={setPage} />
            </>
          ) : (
            <EmptyState filtered={!!(search || status)} onReset={reset} />
          ))}
      </section>
      {creating && <LiveRequestForm onClose={() => setCreating(false)} onSaved={saved} />}
      {issue && (
        <LiveIssueForm
          request={issue === 'direct' ? undefined : issue}
          onClose={() => setIssue(null)}
          onSaved={saved}
        />
      )}
      {action && (
        <LiveActionDialog action={action} onClose={() => setAction(null)} onSaved={saved} />
      )}
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    </>
  );
}
