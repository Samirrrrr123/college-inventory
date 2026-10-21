import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import { loadReferences, queryString, statuses } from '../../api/catalog';
import type { EquipmentRecord, RoomRecord } from '../../api/catalog';
import { errorMessage } from '../../api/errorMessage';
import { useCurrentAccount } from '../../app/CurrentAccount';
import { usePreferences } from '../../app/Preferences';
import { PageHeader, Pagination, Status } from '../../components/Common';
import { Input, Select } from '../../components/Fields';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { ApiFeedback } from '../catalog/ApiFeedback';
import { useApiList } from '../catalog/useApiList';
import { useDebouncedValue } from '../catalog/useDebouncedValue';

interface Check {
  id: string;
  number: number;
  createdAt: string;
  completedAt: string | null;
  room: { id: string; number: string; name: string; building: string };
  createdBy: { id: string; name: string };
  completedBy: { id: string; name: string } | null;
  _count: { items: number };
  summary: { total: number; found: number; missing: number; pending: number };
}
interface Item {
  equipmentId: string;
  equipmentName: string;
  inventoryNumber: string;
  statusAtStart: EquipmentRecord['status'];
  found: boolean | null;
}

export function InventoryPage() {
  const account = useCurrentAccount();
  const { t } = usePreferences();
  const { id } = useParams();
  if (account.role === 'teacher')
    return (
      <section className="panel empty-state">
        <h1>{t('accessDenied')}</h1>
      </section>
    );
  return id ? <InventoryDetail key={id} id={id} /> : <InventoryList />;
}

function StartCheck({ onClose }: { onClose: () => void }) {
  const { t } = usePreferences();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomRecord[] | null>(null);
  const [roomId, setRoomId] = useState('');
  const [failure, setFailure] = useState('');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    loadReferences<RoomRecord>('rooms')
      .then((data) => {
        if (active) {
          setRooms(data);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!roomId) return setFailure(t('chooseCheckRoom'));
    setPending(true);
    setFailure('');
    try {
      const result = await api<{ data: Check }>('/inventory-checks', 'POST', { roomId });
      navigate(`/app/inventory/${result.data.id}`);
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={t('startCheck')}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <p className="dialog-subtitle">{t('checkSnapshotHint')}</p>
        <ApiFeedback
          loading={!rooms && !loadError}
          error={loadError}
          onRetry={() => setRevision((value) => value + 1)}
        />
        <Select
          label={t('room')}
          value={roomId}
          disabled={pending || !rooms}
          onChange={(event) => setRoomId(event.target.value)}
        >
          <option value="">{t('chooseCheckRoom')}</option>
          {rooms?.map((room) => (
            <option value={room.id} key={room.id}>
              {room.number} · {room.building} · {room.name}
            </option>
          ))}
        </Select>
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit" disabled={pending || !rooms?.length}>
            {t(pending ? 'pleaseWait' : 'startCheck')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function InventoryList() {
  const { t, date } = usePreferences();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const list = useApiList<Check>(
    `/inventory-checks?${queryString({ search: term, status, sort, order, page, pageSize: 7 })}`,
    revision,
  );
  return (
    <>
      <PageHeader title={t('inventory')} subtitle={t('inventorySubtitle')}>
        <Button onClick={() => setCreating(true)}>{t('startCheck')}</Button>
      </PageHeader>
      <div className="filters directory-filters">
        <Input
          label={t('search')}
          value={search}
          maxLength={200}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select
          label={t('status')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="active">{t('checkActive')}</option>
          <option value="completed">{t('checkCompleted')}</option>
        </Select>
        <Select
          label={t('sortDirection')}
          value={order}
          onChange={(event) => {
            setOrder(event.target.value);
            setPage(1);
          }}
        >
          <option value="desc">↓</option>
          <option value="asc">↑</option>
        </Select>
        <Select
          label={t('sortBy')}
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
        >
          <option value="createdAt">{t('date')}</option>
          <option value="number">{t('number')}</option>
        </Select>
      </div>
      <section className="panel catalog-panel" aria-label={t('inventory')} aria-busy={list.loading}>
        <div className="section-heading">
          <h2>{t('checkHistory')}</h2>
          <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>
            {t('refreshList')}
          </Button>
        </div>
        <ApiFeedback
          loading={list.loading}
          error={list.error}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {!list.loading && !list.error && list.result && (
          <>
            {!list.result.data.length ? (
              <p className="muted">{t('noChecks')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('number')}</th>
                      <th>{t('room')}</th>
                      <th>{t('date')}</th>
                      <th>{t('checkAuthor')}</th>
                      <th>{t('status')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.result.data.map((check) => (
                      <tr key={check.id}>
                        <td data-label={t('number')}>
                          №{check.number}
                          <small>
                            {check._count.items} · {t('equipment')}
                          </small>
                        </td>
                        <td data-label={t('room')}>
                          {check.room.number}
                          <small>{check.room.building}</small>
                        </td>
                        <td data-label={t('date')}>{date(check.createdAt)}</td>
                        <td data-label={t('checkAuthor')}>{check.createdBy.name}</td>
                        <td data-label={t('status')}>
                          <span
                            className={`badge badge--${check.completedAt ? 'approved' : 'pending'}`}
                          >
                            {t(check.completedAt ? 'checkCompleted' : 'checkActive')}
                          </span>
                        </td>
                        <td data-label={t('actions')}>
                          <Link className="button button--text" to={`/app/inventory/${check.id}`}>
                            {t('open')} →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} pageSize={7} total={list.result.total} onChange={setPage} />
          </>
        )}
      </section>
      {creating && <StartCheck onClose={() => setCreating(false)} />}
    </>
  );
}

function InventoryDetail({ id }: { id: string }) {
  const { t, date } = usePreferences();
  const [check, setCheck] = useState<Check | null>(null);
  const [failure, setFailure] = useState('');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState('asc');
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const root = `/inventory-checks/${id}`;
  const items = useApiList<Item>(
    `${root}/items?${queryString({ search: term, state, page, pageSize: 7, sort: 'inventoryNumber', order })}`,
    revision,
  );
  useEffect(() => {
    let active = true;
    api<{ data: Check }>(root)
      .then((result) => {
        if (active) {
          setCheck(result.data);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error);
      });
    return () => {
      active = false;
    };
  }, [root, revision]);
  async function mutate(path: string, body: unknown, complete = false) {
    setPending(true);
    setFailure('');
    try {
      await api(path, complete ? 'POST' : 'PATCH', body);
      setConfirm(false);
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
      setRevision((value) => value + 1);
    }
  }
  return (
    <>
      <Link className="button button--text" to="/app/inventory">
        ← {t('checkHistory')}
      </Link>
      <PageHeader
        title={`${t('checkTitle')}${check ? ` №${check.number}` : ''}`}
        subtitle={
          check
            ? `${check.room.number} · ${check.room.building} · ${check.createdBy.name} · ${date(check.createdAt)}`
            : t('pleaseWait')
        }
      >
        {check && !check.completedAt && (
          <Button disabled={pending || check.summary.pending > 0} onClick={() => setConfirm(true)}>
            {t('completeCheck')}
          </Button>
        )}
      </PageHeader>
      <ApiFeedback
        loading={!check && !loadError}
        error={loadError}
        onRetry={() => setRevision((value) => value + 1)}
      />
      {check && (
        <>
          <p className="muted">{t(check.completedAt ? 'completedCheckHint' : 'markAllItems')}</p>
          {check.completedAt && (
            <p className="muted small-text">
              {t('checkCompleted')}: {date(check.completedAt)} · {check.completedBy?.name}
            </p>
          )}
          <div className="inventory-summary" aria-label={t('checkResults')}>
            <span>
              {t('checkTotal')}: <strong>{check.summary.total}</strong>
            </span>
            <span>
              {t('found')}: <strong>{check.summary.found}</strong>
            </span>
            <span>
              {t('checkMissing')}: <strong>{check.summary.missing}</strong>
            </span>
            <span>
              {t('checkPending')}: <strong>{check.summary.pending}</strong>
            </span>
          </div>
          <div className="filters directory-filters">
            <Input
              label={t('search')}
              value={search}
              maxLength={200}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Select
              label={t('checkResult')}
              value={state}
              onChange={(event) => {
                setState(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allStatuses')}</option>
              <option value="pending">{t('checkPending')}</option>
              <option value="found">{t('found')}</option>
              <option value="missing">{t('checkMissing')}</option>
            </Select>
            <Select
              label={t('sortDirection')}
              value={order}
              onChange={(event) => {
                setOrder(event.target.value);
                setPage(1);
              }}
            >
              <option value="asc">{t('inventoryNumber')} ↑</option>
              <option value="desc">{t('inventoryNumber')} ↓</option>
            </Select>
          </div>
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          <section
            className="panel catalog-panel"
            aria-label={t('checkItems')}
            aria-busy={items.loading}
          >
            <ApiFeedback
              loading={items.loading}
              error={items.error}
              onRetry={() => setRevision((value) => value + 1)}
            />
            {!items.loading && !items.error && items.result && (
              <>
                {!items.result.data.length ? (
                  <p className="muted">{t('noResults')}</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t('equipment')}</th>
                          <th>{t('statusAtStart')}</th>
                          <th>{t('checkResult')}</th>
                          {!check.completedAt && <th>{t('actions')}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.result.data.map((item) => (
                          <tr key={item.equipmentId}>
                            <td data-label={t('equipment')}>
                              <strong>{item.equipmentName}</strong>
                              <small>{item.inventoryNumber}</small>
                            </td>
                            <td data-label={t('statusAtStart')}>
                              <Status value={statuses[item.statusAtStart]} />
                            </td>
                            <td data-label={t('checkResult')}>
                              {t(
                                item.found === null
                                  ? 'checkPending'
                                  : item.found
                                    ? 'found'
                                    : 'checkMissing',
                              )}
                            </td>
                            {!check.completedAt && (
                              <td data-label={t('actions')}>
                                <div className="row-actions">
                                  <Button
                                    variant="secondary"
                                    aria-pressed={item.found === true}
                                    disabled={pending}
                                    onClick={() =>
                                      void mutate(`${root}/items/${item.equipmentId}`, {
                                        found: true,
                                      })
                                    }
                                  >
                                    {t('markFound')}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    aria-pressed={item.found === false}
                                    disabled={pending}
                                    onClick={() =>
                                      void mutate(`${root}/items/${item.equipmentId}`, {
                                        found: false,
                                      })
                                    }
                                  >
                                    {t('markMissing')}
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination
                  page={page}
                  pageSize={7}
                  total={items.result.total}
                  onChange={setPage}
                />
              </>
            )}
          </section>
        </>
      )}
      {confirm && (
        <Dialog
          title={t('completeCheck')}
          onClose={() => {
            if (!pending) setConfirm(false);
          }}
        >
          <p>{t('confirmCompleteCheck')}</p>
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          <div className="dialog-actions">
            <Button disabled={pending} onClick={() => void mutate(`${root}/complete`, {}, true)}>
              {t('confirmCheckCompletion')}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirm(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
