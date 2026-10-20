import { useState } from 'react';
import { usePreferences } from '../app/Preferences';
import { useDemo } from '../demo/DemoProvider';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Fields';
import { Dialog } from '../components/Dialog';
import { EmptyState, Notice, PageHeader, Status, Tabs } from '../components/Common';
import { RequestForm } from '../features/requests/RequestForm';
import { IssueForm } from '../features/requests/IssueForm';
import type { EquipmentRequest, Loan } from '../domain/types';

export function RequestsPage() {
  const { t, date } = usePreferences();
  const demo = useDemo();
  const { person, equipment, people } = demo;
  const [tab, setTab] = useState<'requests' | 'loans' | 'returns'>('requests');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [review, setReview] = useState<EquipmentRequest | null>(null);
  const [returning, setReturning] = useState<Loan | null>(null);
  const [creating, setCreating] = useState(false);
  const [issuing, setIssuing] = useState<{ request?: EquipmentRequest } | null>(null);
  const [notice, setNotice] = useState('');
  const staff = person.role !== 'TEACHER';
  const names = (ids: string[]) =>
    ids.map((id) => equipment.find((item) => item.id === id)?.name ?? id).join(', ');
  const matches = (number: string, ids: string[], personId: string) =>
    `${number} ${names(ids)} ${people.find((item) => item.id === personId)?.name}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase().trim());
  const requests = demo.requests.filter(
    (item) =>
      (staff || item.personId === person.id) &&
      (!status || item.status === status) &&
      matches(item.number, item.equipmentIds, item.personId),
  );
  const loans = demo.loans.filter(
    (item) =>
      (staff || item.personId === person.id) &&
      (tab === 'returns' ? !!item.returnedAt : !item.returnedAt) &&
      matches(item.number, item.equipmentIds, item.personId),
  );

  return (
    <>
      <PageHeader title={t('requests')} subtitle={t('requestsSubtitle')}>
        <Button onClick={() => (staff ? setIssuing({}) : setCreating(true))}>
          {t(staff ? 'issue' : 'newRequest')}
        </Button>
      </PageHeader>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'requests', label: t('requestList') },
          { value: 'loans', label: t('activeLoans') },
          { value: 'returns', label: t('returns') },
        ]}
      />
      <div className="filters filters--two">
        <Input
          label={t('search')}
          placeholder={t('requestSearch')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {tab === 'requests' && (
          <Select
            label={t('status')}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">{t('allStatuses')}</option>
            <option value="PENDING">{t('pending')}</option>
            <option value="APPROVED">{t('approved')}</option>
            <option value="REJECTED">{t('rejected')}</option>
          </Select>
        )}
      </div>
      <section className="panel">
        <h2>
          {t(tab === 'requests' ? 'requestList' : tab === 'loans' ? 'activeLoans' : 'returns')}
        </h2>
        {tab === 'requests' ? (
          requests.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('requestNumber')}</th>
                    <th>{t('equipment')}</th>
                    <th>{t('teacher')}</th>
                    <th>{t('purpose')}</th>
                    <th>{t('status')}</th>
                    {staff && <th>{t('actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr key={item.id}>
                      <td data-label={t('requestNumber')}>
                        {item.number}
                        <small>{date(item.createdAt)}</small>
                      </td>
                      <td data-label={t('equipment')}>
                        <strong>{names(item.equipmentIds)}</strong>
                      </td>
                      <td data-label={t('teacher')}>
                        {people.find((person) => person.id === item.personId)?.name}
                      </td>
                      <td data-label={t('purpose')} className="purpose-cell">
                        {item.purpose}
                      </td>
                      <td data-label={t('status')}>
                        <Status value={item.status} />
                      </td>
                      {staff && (
                        <td data-label={t('actions')}>
                          <Button
                            variant="text"
                            aria-label={`${t('review')}: ${item.number}`}
                            onClick={() => setReview(item)}
                          >
                            {t('review')} →
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState filtered={!!search || !!status} />
          )
        ) : loans.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('equipment')}</th>
                  <th>{t('borrower')}</th>
                  <th>{t(tab === 'returns' ? 'returned' : 'returnBy')}</th>
                  {staff && tab === 'loans' && <th>{t('actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id}>
                    <td data-label={t('equipment')}>
                      <strong>{names(loan.equipmentIds)}</strong>
                      <small>{loan.number}</small>
                    </td>
                    <td data-label={t('borrower')}>
                      {people.find((item) => item.id === loan.personId)?.name}
                    </td>
                    <td data-label={t('date')}>{date(loan.returnedAt ?? loan.dueDate)}</td>
                    {staff && tab === 'loans' && (
                      <td data-label={t('actions')}>
                        <Button
                          variant="text"
                          aria-label={`${t('returnEquipment')}: ${loan.number}`}
                          onClick={() => setReturning(loan)}
                        >
                          {t('returnEquipment')}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState />
        )}
      </section>
      {review && (
        <Dialog title={`${t('requestNumber')} ${review.number}`} onClose={() => setReview(null)}>
          <p className="detail-title">{names(review.equipmentIds)}</p>
          <dl className="detail-list">
            <div>
              <dt>{t('teacher')}</dt>
              <dd>{people.find((item) => item.id === review.personId)?.name}</dd>
            </div>
            <div>
              <dt>{t('purpose')}</dt>
              <dd>{review.purpose}</dd>
            </div>
            <div>
              <dt>{t('status')}</dt>
              <dd>
                <Status value={review.status} />
              </dd>
            </div>
          </dl>
          <p className="muted small-text">{t('noReservation')}</p>
          {review.status === 'PENDING' && (
            <div className="dialog-actions">
              <Button
                onClick={() => {
                  demo.decideRequest(review.id, 'APPROVED');
                  setReview(null);
                  setNotice(t('requestUpdated'));
                }}
              >
                {t('approve')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  demo.decideRequest(review.id, 'REJECTED');
                  setReview(null);
                  setNotice(t('requestUpdated'));
                }}
              >
                {t('reject')}
              </Button>
            </div>
          )}
          {review.status === 'APPROVED' &&
            !demo.loans.some((loan) => loan.requestId === review.id) && (
              <div className="dialog-actions">
                <Button
                  onClick={() => {
                    setIssuing({ request: review });
                    setReview(null);
                  }}
                >
                  {t('issue')}
                </Button>
              </div>
            )}
        </Dialog>
      )}
      {returning && (
        <Dialog title={t('returnTitle')} onClose={() => setReturning(null)}>
          <p>{names(returning.equipmentIds)}</p>
          <p className="muted">{t('returnNote')}</p>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                const saved = demo.returnLoan(returning.id);
                setReturning(null);
                setNotice(t(saved ? 'returnSaved' : 'returnAlreadyRecorded'));
              }}
            >
              {t('confirm')}
            </Button>
            <Button variant="secondary" onClick={() => setReturning(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      )}
      {creating && (
        <RequestForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setSearch('');
            setStatus('');
            setNotice(t('requestCreated'));
          }}
        />
      )}
      {issuing && (
        <IssueForm
          request={issuing.request}
          onClose={() => setIssuing(null)}
          onSaved={() => {
            setIssuing(null);
            setTab('loans');
            setSearch('');
            setNotice(t('issueSaved'));
          }}
        />
      )}
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    </>
  );
}
