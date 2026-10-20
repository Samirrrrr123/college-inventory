import { useState } from 'react';
import { usePreferences } from '../app/Preferences';
import { useDemo } from '../demo/DemoProvider';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Fields';
import { Dialog } from '../components/Dialog';
import { EmptyState, Notice, PageHeader, Status, Tabs } from '../components/Common';
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
  const [equipmentId, setEquipmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const staff = person.role !== 'TEACHER';
  const canSeePerson = (id: string) => staff || id === person.id;
  const matches = (number: string, equipmentId: string, personId: string) =>
    `${number} ${equipment.find((item) => item.id === equipmentId)?.name} ${people.find((item) => item.id === personId)?.name}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase().trim());
  const requests = demo.requests.filter(
    (item) =>
      canSeePerson(item.personId) &&
      (!status || item.status === status) &&
      matches(item.number, item.equipmentId, item.personId),
  );
  const loans = demo.loans.filter(
    (item) =>
      canSeePerson(item.personId) &&
      (tab === 'returns' ? !!item.returnedAt : !item.returnedAt) &&
      matches(item.number, item.equipmentId, item.personId),
  );

  return (
    <>
      <PageHeader title={t('requests')} subtitle={t('requestsSubtitle')}>
        <Button
          onClick={() => {
            if (staff) {
              setNotice(t('backendPending'));
              return;
            }
            setCreating(true);
            setEquipmentId(equipment.find((item) => item.status === 'AVAILABLE')?.id ?? '');
          }}
        >
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
                    <th>{t('period')}</th>
                    <th>{t('status')}</th>
                    {staff && <th>{t('actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr key={item.id}>
                      <td data-label={t('requestNumber')}>{item.number}</td>
                      <td data-label={t('equipment')}>
                        <strong>{equipment.find((eq) => eq.id === item.equipmentId)?.name}</strong>
                      </td>
                      <td data-label={t('teacher')}>
                        {people.find((person) => person.id === item.personId)?.name}
                      </td>
                      <td data-label={t('period')}>
                        {date(item.startDate)}
                        {item.endDate !== item.startDate && ` — ${date(item.endDate)}`}
                      </td>
                      <td data-label={t('status')}>
                        <Status value={item.status} />
                      </td>
                      {staff && (
                        <td data-label={t('actions')}>
                          <Button variant="text" onClick={() => setReview(item)}>
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
                      <strong>
                        {equipment.find((item) => item.id === loan.equipmentId)?.name}
                      </strong>
                      <small>{loan.number}</small>
                    </td>
                    <td data-label={t('borrower')}>
                      {people.find((item) => item.id === loan.personId)?.name}
                    </td>
                    <td data-label={t('date')}>{date(loan.returnedAt ?? loan.dueDate)}</td>
                    {staff && tab === 'loans' && (
                      <td data-label={t('actions')}>
                        <Button variant="text" onClick={() => setReturning(loan)}>
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
          <p className="detail-title">
            {equipment.find((item) => item.id === review.equipmentId)?.name}
          </p>
          <dl className="detail-list">
            <div>
              <dt>{t('teacher')}</dt>
              <dd>{people.find((item) => item.id === review.personId)?.name}</dd>
            </div>
            <div>
              <dt>{t('period')}</dt>
              <dd>
                {date(review.startDate)} — {date(review.endDate)}
              </dd>
            </div>
            <div>
              <dt>{t('status')}</dt>
              <dd>
                <Status value={review.status} />
              </dd>
            </div>
          </dl>
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
        </Dialog>
      )}
      {returning && (
        <Dialog title={t('returnTitle')} onClose={() => setReturning(null)}>
          <p>{equipment.find((item) => item.id === returning.equipmentId)?.name}</p>
          <p className="muted">{t('returnNote')}</p>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                demo.returnLoan(returning.id);
                setReturning(null);
                setNotice(t('returnSaved'));
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
        <Dialog title={t('newRequest')} onClose={() => setCreating(false)}>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!equipmentId || !startDate || !endDate) {
                setError(t('required'));
                return;
              }
              if (endDate < startDate) {
                setError(t('dateError'));
                return;
              }
              demo.addRequest({ equipmentId, startDate, endDate });
              setCreating(false);
              setError('');
              setNotice(t('requestCreated'));
            }}
          >
            <Select
              label={t('equipment')}
              value={equipmentId}
              onChange={(event) => setEquipmentId(event.target.value)}
            >
              {equipment
                .filter((item) => item.status === 'AVAILABLE')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
            <div className="form-grid">
              <Input
                type="date"
                label={t('startDate')}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
              <Input
                type="date"
                label={t('endDate')}
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <Button type="submit">{t('sendRequest')}</Button>
              <Button variant="secondary" onClick={() => setCreating(false)}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    </>
  );
}
