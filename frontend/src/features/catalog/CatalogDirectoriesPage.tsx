import { useState } from 'react';
import { Link } from 'react-router';
import type { CategoryRecord, RoomRecord } from '../../api/catalog';
import { queryString } from '../../api/catalog';
import { useCurrentAccount } from '../../app/CurrentAccount';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Input, Select } from '../../components/Fields';
import { EmptyState, Notice, PageHeader, Pagination } from '../../components/Common';
import { useDebouncedValue } from './useDebouncedValue';
import { useApiList } from './useApiList';
import { ApiFeedback } from './ApiFeedback';
import { ApiDeleteDialog } from './ApiDeleteDialog';
import { CatalogDirectoryForm } from './CatalogDirectoryForm';

type Item = RoomRecord | CategoryRecord;

export function CatalogDirectoriesPage({ kind }: { kind: 'rooms' | 'categories' }) {
  const { t } = usePreferences();
  const account = useCurrentAccount();
  const isRoom = kind === 'rooms';
  const canManage = account.role !== 'teacher';
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [floor, setFloor] = useState('');
  const [building, setBuilding] = useState('');
  const buildingTerm = useDebouncedValue(building);
  const [sort, setSort] = useState(isRoom ? 'number' : 'name');
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<Item | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [notice, setNotice] = useState('');
  const path = `/${kind}?${queryString({ search: term, sort, order: ascending ? 'asc' : 'desc', page, pageSize: 10, ...(isRoom ? { floor, building: buildingTerm } : {}) })}`;
  const list = useApiList<Item>(path, revision);
  function saved() {
    setForm(null);
    setRevision((value) => value + 1);
    setNotice(t('liveSaved'));
  }
  function reset() {
    setSearch('');
    setFloor('');
    setBuilding('');
    setPage(1);
  }
  return (
    <>
      <PageHeader
        title={t(isRoom ? 'rooms' : 'categories')}
        subtitle={t(isRoom ? 'roomsSubtitle' : 'categoriesSubtitle')}
      >
        {canManage && (
          <Button onClick={() => setForm('new')}>+ {t(isRoom ? 'addRoom' : 'addCategory')}</Button>
        )}
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
        {isRoom && (
          <>
            <Input
              label={t('building')}
              value={building}
              maxLength={100}
              onChange={(event) => {
                setBuilding(event.target.value);
                setPage(1);
              }}
            />
            <Input
              label={t('floor')}
              type="number"
              min={-5}
              max={100}
              step={1}
              value={floor}
              onChange={(event) => {
                setFloor(event.target.value);
                setPage(1);
              }}
            />
            <Select
              label={t('sortBy')}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="number">{t('roomNumber')}</option>
              <option value="name">{t('name')}</option>
              <option value="building">{t('building')}</option>
              <option value="floor">{t('floor')}</option>
            </Select>
          </>
        )}
      </div>
      <section className="panel catalog-panel" aria-busy={list.loading}>
        <div className="section-heading">
          <div className="heading-inline">
            <h2>{t(isRoom ? 'rooms' : 'categories')}</h2>
            {list.result && <span className="count-label">{list.result.total}</span>}
          </div>
          <div className="row-actions">
            <Button
              variant="secondary"
              aria-label={t('sortName')}
              onClick={() => {
                setAscending(!ascending);
                setPage(1);
              }}
            >
              {ascending ? '↑' : '↓'}
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
                      {isRoom && <th>{t('roomNumber')}</th>}
                      <th>{t('name')}</th>
                      {isRoom && (
                        <>
                          <th>{t('building')}</th>
                          <th>{t('floor')}</th>
                        </>
                      )}
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.result.data.map((item) => (
                      <tr key={item.id}>
                        {'number' in item && <td data-label={t('roomNumber')}>{item.number}</td>}
                        <td data-label={t('name')}>
                          <strong>{item.name}</strong>
                        </td>
                        {'number' in item && (
                          <>
                            <td data-label={t('building')}>{item.building}</td>
                            <td data-label={t('floor')}>{item.floor}</td>
                          </>
                        )}
                        <td data-label={t('actions')}>
                          <div className="row-actions">
                            {'number' in item && (
                              <Link
                                className="button button--text"
                                to={`/app/equipment?roomId=${item.id}`}
                              >
                                {t('equipment')} →
                              </Link>
                            )}
                            {canManage && (
                              <>
                                <Button
                                  variant="text"
                                  onClick={() => setForm(item)}
                                  aria-label={`${t('edit')}: ${item.name}`}
                                >
                                  {t('edit')}
                                </Button>
                                <Button
                                  variant="text"
                                  onClick={() => setDeleting(item)}
                                  aria-label={`${t('delete')}: ${item.name}`}
                                >
                                  {t('delete')}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={list.result.total} pageSize={10} onChange={setPage} />
            </>
          ) : (
            <EmptyState filtered={!!(search || building || floor)} onReset={reset} />
          ))}
      </section>
      {form &&
        (isRoom ? (
          <CatalogDirectoryForm
            kind="rooms"
            item={form !== 'new' && 'number' in form ? form : undefined}
            onClose={() => setForm(null)}
            onSaved={saved}
          />
        ) : (
          <CatalogDirectoryForm
            kind="categories"
            item={form === 'new' ? undefined : form}
            onClose={() => setForm(null)}
            onSaved={saved}
          />
        ))}
      {deleting && (
        <ApiDeleteDialog
          title={t(isRoom ? 'deleteRoom' : 'deleteCategory')}
          name={deleting.name}
          path={`/${kind}/${deleting.id}`}
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
