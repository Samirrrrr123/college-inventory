import { useEffect, useState } from 'react';
import { useCurrentAccount } from '../../app/CurrentAccount';
import { usePreferences } from '../../app/Preferences';
import { historyActions, historyEntities, historyRoom } from '../../api/history';
import type { AuditRecord, MovementRecord } from '../../api/history';
import { loadReferences, queryString } from '../../api/catalog';
import type { RoomRecord } from '../../api/catalog';
import { Button } from '../../components/Button';
import { Input, Select } from '../../components/Fields';
import { EmptyState, PageHeader, Pagination } from '../../components/Common';
import { ApiFeedback } from '../catalog/ApiFeedback';
import { useApiList } from '../catalog/useApiList';
import { useDebouncedValue } from '../catalog/useDebouncedValue';

type Kind = 'movements' | 'audit';
const pageSize = 10;
export function HistoryPage({ kind }: { kind: Kind }) {
  const account = useCurrentAccount();
  const { t } = usePreferences();
  if (account.role === 'teacher' || (kind === 'audit' && account.role !== 'admin'))
    return (
      <section className="panel empty-state">
        <h1>{t('accessDenied')}</h1>
      </section>
    );
  return <HistoryList key={kind} kind={kind} />;
}

function HistoryList({ kind }: { kind: Kind }) {
  const { t } = usePreferences();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [actorSearch, setActorSearch] = useState('');
  const actor = useDebouncedValue(actorSearch);
  const [fromRoomId, setFromRoom] = useState('');
  const [toRoomId, setToRoom] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [referenceError, setReferenceError] = useState<unknown>(null);
  const [referencesLoading, setReferencesLoading] = useState(kind === 'movements');
  useEffect(() => {
    if (kind !== 'movements') return;
    let active = true;
    loadReferences<RoomRecord>('rooms')
      .then((items) => {
        if (active) {
          setRooms(items);
          setReferenceError(null);
          setReferencesLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setReferenceError(error);
          setReferencesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [kind, revision]);
  const change = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  const reset = () => {
    setSearch('');
    setActorSearch('');
    setFromRoom('');
    setToRoom('');
    setAction('');
    setEntityType('');
    setFrom('');
    setTo('');
    setOrder('desc');
    setPage(1);
  };
  const invalidDates = !!from && !!to && from > to;
  const query = queryString({
    search: term,
    actorSearch: actor,
    ...(kind === 'movements' ? { fromRoomId, toRoomId } : { action, entityType }),
    from: from ? `${from}T00:00:00.000Z` : undefined,
    to: to ? `${to}T23:59:59.999Z` : undefined,
    sort: 'createdAt',
    order,
    page,
    pageSize,
  });
  return (
    <>
      <PageHeader
        title={t(kind)}
        subtitle={t(kind === 'movements' ? 'historyMovementsSubtitle' : 'historyAuditSubtitle')}
      />
      <div className="filters directory-filters history-filters">
        <Input
          label={t('search')}
          placeholder={t(kind === 'movements' ? 'historyEquipmentSearch' : 'historyAuditSearch')}
          value={search}
          maxLength={200}
          onChange={(event) => change(setSearch, event.target.value)}
        />
        {kind === 'movements' && (
          <Input
            label={t('historyActor')}
            value={actorSearch}
            maxLength={100}
            onChange={(event) => change(setActorSearch, event.target.value)}
          />
        )}
        {kind === 'movements' ? (
          <>
            {(
              [
                ['fromRoom', fromRoomId, setFromRoom],
                ['toRoom', toRoomId, setToRoom],
              ] as const
            ).map(([label, value, setter]) => (
              <Select
                key={label}
                label={t(label)}
                value={value}
                disabled={referencesLoading || !!referenceError}
                onChange={(event) => change(setter, event.target.value)}
              >
                <option value="">{t('allRooms')}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {historyRoom(room)}
                  </option>
                ))}
              </Select>
            ))}
          </>
        ) : (
          <>
            <Select
              label={t('action')}
              value={action}
              onChange={(event) => change(setAction, event.target.value)}
            >
              <option value="">{t('historyAllActions')}</option>
              {Object.entries(historyActions).map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </Select>
            <Select
              label={t('historyEntityType')}
              value={entityType}
              onChange={(event) => change(setEntityType, event.target.value)}
            >
              <option value="">{t('historyAllEntities')}</option>
              {Object.entries(historyEntities).map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </Select>
          </>
        )}
        <Input
          type="date"
          label={t('historyFromDate')}
          value={from}
          max={to || undefined}
          onChange={(event) => change(setFrom, event.target.value)}
        />
        <Input
          type="date"
          label={t('historyToDate')}
          value={to}
          min={from || undefined}
          onChange={(event) => change(setTo, event.target.value)}
        />
        <Select
          label={t('sortDirection')}
          value={order}
          onChange={(event) => change(setOrder, event.target.value)}
        >
          <option value="desc">{t('historyNewest')}</option>
          <option value="asc">{t('historyOldest')}</option>
        </Select>
      </div>
      <div className="history-toolbar">
        <Button variant="secondary" onClick={reset}>
          {t('resetFilters')}
        </Button>
        <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>
          {t('refreshList')}
        </Button>
      </div>
      {referenceError && (
        <ApiFeedback
          loading={false}
          error={referenceError}
          onRetry={() => setRevision((value) => value + 1)}
        />
      )}
      {invalidDates ? (
        <p role="alert" className="field-error">
          {t('historyInvalidDates')}
        </p>
      ) : (
        <HistoryResults
          kind={kind}
          query={query}
          revision={revision}
          page={page}
          setPage={setPage}
          reset={reset}
          retry={() => setRevision((value) => value + 1)}
        />
      )}
    </>
  );
}

function HistoryResults({
  kind,
  query,
  revision,
  page,
  setPage,
  reset,
  retry,
}: {
  kind: Kind;
  query: string;
  revision: number;
  page: number;
  setPage: (page: number) => void;
  reset: () => void;
  retry: () => void;
}) {
  const { t, language } = usePreferences();
  const list = useApiList<MovementRecord | AuditRecord>(`/${kind}?${query}`, revision);
  const timestamp = (value: string) =>
    new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(value));
  return (
    <section
      className="panel catalog-panel history-panel"
      aria-label={t(kind)}
      aria-busy={list.loading}
    >
      <ApiFeedback loading={list.loading} error={list.error} onRetry={retry} />
      {!list.loading && !list.error && list.result && (
        <>
          {!list.result.data.length ? (
            <EmptyState filtered onReset={reset} />
          ) : (
            <div className="table-wrap">
              <table className="data-table history-table">
                <thead>
                  <tr>
                    <th>{t('historyTimestamp')}</th>
                    <th>{t(kind === 'movements' ? 'equipment' : 'actor')}</th>
                    <th>{t(kind === 'movements' ? 'fromRoom' : 'action')}</th>
                    <th>{t(kind === 'movements' ? 'toRoom' : 'object')}</th>
                    <th>{t(kind === 'movements' ? 'actor' : 'details')}</th>
                    {kind === 'movements' && <th>{t('historyReason')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.result.data.map((entry) => (
                    <tr key={entry.id}>
                      <td data-label={t('historyTimestamp')}>
                        <time dateTime={entry.createdAt}>{timestamp(entry.createdAt)}</time>
                      </td>
                      {'equipment' in entry ? (
                        <>
                          <td data-label={t('equipment')}>
                            <strong>{entry.equipment.name}</strong>
                            <small>{entry.equipment.inventoryNumber}</small>
                          </td>
                          <td data-label={t('fromRoom')}>{historyRoom(entry.fromRoom)}</td>
                          <td data-label={t('toRoom')}>{historyRoom(entry.toRoom)}</td>
                          <td data-label={t('actor')}>{entry.actor.name}</td>
                          <td data-label={t('historyReason')}>
                            {entry.reason === 'Room changed in equipment card'
                              ? t('historyCardMove')
                              : entry.reason}
                          </td>
                        </>
                      ) : (
                        <>
                          <td data-label={t('actor')}>{entry.actor.name}</td>
                          <td data-label={t('action')}>
                            {historyActions[entry.action]
                              ? t(historyActions[entry.action])
                              : entry.action}
                          </td>
                          <td data-label={t('object')}>
                            <div>
                              <strong>
                                {historyEntities[entry.entityType ?? 'account']
                                  ? t(historyEntities[entry.entityType ?? 'account'])
                                  : entry.entityType}
                              </strong>
                              {entry.subject ?? t('historyDeletedSubject')}
                              {!entry.subject && entry.entityId && <small>{entry.entityId}</small>}
                            </div>
                          </td>
                          <td data-label={t('details')}>
                            {entry.details && Object.keys(entry.details).length ? (
                              <details>
                                <summary>{t('details')}</summary>
                                <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                              </details>
                            ) : (
                              '—'
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            total={list.result.total}
            pageSize={pageSize}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
