import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../api/client';
import { loadReferences, queryString, statuses } from '../../api/catalog';
import type { CategoryRecord, EquipmentRecord, RoomRecord } from '../../api/catalog';
import { errorMessage } from '../../api/errorMessage';
import { useCurrentAccount } from '../../app/CurrentAccount';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Input, Select } from '../../components/Fields';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { EmptyState, Notice, PageHeader, Pagination, Status } from '../../components/Common';
import { useApiList } from './useApiList';
import { useDebouncedValue } from './useDebouncedValue';
import { ApiFeedback } from './ApiFeedback';
import { ApiDeleteDialog } from './ApiDeleteDialog';
import { CatalogEquipmentForm } from './CatalogEquipmentForm';

export function CatalogEquipmentPage() {
  const { t, date } = usePreferences();
  const account = useCurrentAccount();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [categoryId, setCategoryId] = useState('');
  const [roomId, setRoomId] = useState(params.get('roomId') ?? '');
  const [status, setStatus] = useState('');
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [references, setReferences] = useState<{
    categories: CategoryRecord[];
    rooms: RoomRecord[];
  } | null>(null);
  const [referenceError, setReferenceError] = useState<unknown>(null);
  const [form, setForm] = useState<EquipmentRecord | 'new' | null>(null);
  const [selected, setSelected] = useState<EquipmentRecord | null>(null);
  const [deleting, setDeleting] = useState<EquipmentRecord | null>(null);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState('');
  const canManage = account.role !== 'teacher';
  const path = `/equipment?${queryString({ search: term, categoryId, roomId, status, sort: 'name', order: ascending ? 'asc' : 'desc', page, pageSize: 7 })}`;
  const list = useApiList<EquipmentRecord>(path, revision);
  useEffect(() => {
    let active = true;
    Promise.all([loadReferences<CategoryRecord>('categories'), loadReferences<RoomRecord>('rooms')])
      .then(([categories, rooms]) => {
        if (active) {
          setReferences({ categories, rooms });
          setReferenceError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) setReferenceError(error);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const categories = references?.categories ?? [];
  const rooms = references?.rooms ?? [];
  const loading = list.loading || (!references && !referenceError);
  const failure = referenceError ?? list.error;

  function reset() {
    setSearch('');
    setCategoryId('');
    setRoomId('');
    setStatus('');
    setPage(1);
  }
  async function open(id: string) {
    setOpening(true);
    try {
      const result = await api<{ data: EquipmentRecord }>(`/equipment/${id}`);
      setSelected(result.data);
    } catch (error) {
      setNotice(errorMessage(error, t));
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <PageHeader title={t('equipment')} subtitle={t('equipmentSubtitle')}>
        {canManage && (
          <Button
            onClick={() => setForm('new')}
            disabled={!categories.length || !rooms.length || !!referenceError}
          >
            + {t('add')}
          </Button>
        )}
      </PageHeader>
      {canManage && references && (!categories.length || !rooms.length) && (
        <p className="auth-submit-notice">{t('referencesRequired')}</p>
      )}
      <div className="filters">
        <Input
          label={t('search')}
          placeholder={t('equipmentSearch')}
          value={search}
          maxLength={200}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select
          label={t('category')}
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          label={t('status')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="available">{t('available')}</option>
          <option value="issued">{t('issued')}</option>
          <option value="repair">{t('maintenance')}</option>
          <option value="written_off">{t('writtenOff')}</option>
        </Select>
        <Select
          label={t('room')}
          value={roomId}
          onChange={(event) => {
            setRoomId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allRooms')}</option>
          {rooms.map((item) => (
            <option key={item.id} value={item.id}>
              {item.number} · {item.building}
            </option>
          ))}
        </Select>
      </div>
      <section className="panel catalog-panel" aria-label={t('equipment')} aria-busy={loading}>
        <div className="section-heading">
          <div className="heading-inline">
            <h2>{t('equipment')}</h2>
            {list.result && <span className="count-label">{list.result.total}</span>}
          </div>
          <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>
            {t('refreshList')}
          </Button>
        </div>
        <ApiFeedback
          loading={loading}
          error={failure}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {opening && (
          <p className="muted" role="status">
            {t('pleaseWait')}
          </p>
        )}
        {!loading &&
          !failure &&
          list.result &&
          (list.result.data.length ? (
            <>
              <div className="table-wrap">
                <table className="data-table equipment-table">
                  <thead>
                    <tr>
                      <th aria-sort={ascending ? 'ascending' : 'descending'}>
                        <button
                          className="sort-button"
                          type="button"
                          aria-label={t('sortName')}
                          onClick={() => {
                            setAscending(!ascending);
                            setPage(1);
                          }}
                        >
                          {t('equipment')} {ascending ? '↑' : '↓'}
                        </button>
                      </th>
                      <th>{t('category')}</th>
                      <th>{t('room')}</th>
                      <th>{t('status')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-label={t('equipment')}>
                          <strong>{item.name}</strong>
                          <small>{item.inventoryNumber}</small>
                        </td>
                        <td data-label={t('category')}>{item.category.name}</td>
                        <td data-label={t('room')}>{item.room.number}</td>
                        <td data-label={t('status')}>
                          <Status value={statuses[item.status]} />
                        </td>
                        <td data-label={t('actions')}>
                          <Button
                            variant="text"
                            disabled={opening}
                            onClick={() => void open(item.id)}
                            aria-label={`${t('open')}: ${item.name}`}
                          >
                            {t('open')} →
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={list.result.total} pageSize={7} onChange={setPage} />
            </>
          ) : (
            <EmptyState filtered={!!(search || status || categoryId || roomId)} onReset={reset} />
          ))}
      </section>
      {form && (
        <CatalogEquipmentForm
          item={form === 'new' ? undefined : form}
          categories={categories}
          rooms={rooms}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setRevision((value) => value + 1);
            setNotice(t('liveSaved'));
          }}
        />
      )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelected(null)} wide>
          <p className="dialog-subtitle">
            {selected.inventoryNumber} · {selected.category.name}
          </p>
          <div className="detail-grid">
            <div className="equipment-placeholder">
              <Icon name="equipmentPlaceholder" />
              <span>{t('photoMissing')}</span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>{t('status')}</dt>
                <dd>
                  <Status value={statuses[selected.status]} />
                </dd>
              </div>
              <div>
                <dt>{t('room')}</dt>
                <dd>
                  {selected.room.number} · {selected.room.building}
                </dd>
              </div>
              <div>
                <dt>{t('serialNumber')}</dt>
                <dd>{selected.serialNumber || '—'}</dd>
              </div>
              <div>
                <dt>{t('date')}</dt>
                <dd>{date(selected.updatedAt)}</dd>
              </div>
            </dl>
          </div>
          {selected.description && (
            <section className="catalog-description">
              <h3>{t('description')}</h3>
              <p>{selected.description}</p>
            </section>
          )}
          <p className="muted small-text">{t('uploadNotReady')}</p>
          {canManage && (
            <div className="dialog-actions">
              <Button
                onClick={() => {
                  setForm(selected);
                  setSelected(null);
                }}
              >
                {t('edit')}
              </Button>
              <Button
                variant="danger"
                disabled={selected.status === 'issued'}
                onClick={() => {
                  setDeleting(selected);
                  setSelected(null);
                }}
              >
                {t('delete')}
              </Button>
            </div>
          )}
        </Dialog>
      )}
      {deleting && (
        <ApiDeleteDialog
          title={t('deleteTitle')}
          name={`${deleting.name} · ${deleting.inventoryNumber}`}
          path={`/equipment/${deleting.id}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setPage(1);
            setRevision((value) => value + 1);
            setNotice(t('liveDeleted'));
          }}
        />
      )}
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    </>
  );
}
