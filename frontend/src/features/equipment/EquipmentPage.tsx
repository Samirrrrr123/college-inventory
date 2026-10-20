import { useState } from 'react';
import { useDemo } from '../../demo/DemoProvider';
import { usePreferences } from '../../app/Preferences';
import type { Equipment } from '../../domain/types';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Dialog } from '../../components/Dialog';
import { Input, Select } from '../../components/Fields';
import { EmptyState, Notice, PageHeader, Pagination, Status } from '../../components/Common';
import { EquipmentForm } from './EquipmentForm';

export function EquipmentPage() {
  const { t, language, date } = usePreferences();
  const demo = useDemo();
  const { equipment, categories, rooms, person } = demo;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [roomId, setRoomId] = useState('');
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<Equipment | 'new' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Equipment | null>(null);
  const [moving, setMoving] = useState<Equipment | null>(null);
  const [destination, setDestination] = useState('');
  const [notice, setNotice] = useState('');
  const canManage = person.role !== 'TEACHER';
  const selected = equipment.find((item) => item.id === selectedId);
  const filtered = equipment
    .filter(
      (item) =>
        (!search ||
          `${item.name} ${item.inventoryNumber}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase().trim())) &&
        (!category || item.categoryId === category) &&
        (!status || item.status === status) &&
        (!roomId || item.roomId === roomId),
    )
    .sort((a, b) => a.name.localeCompare(b.name, language) * (ascending ? 1 : -1));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 7)));
  const visible = filtered.slice((currentPage - 1) * 7, currentPage * 7);

  function reset() {
    setSearch('');
    setCategory('');
    setStatus('');
    setRoomId('');
    setPage(1);
  }

  return (
    <>
      <PageHeader title={t('equipment')} subtitle={t('equipmentSubtitle')}>
        {canManage && <Button onClick={() => setForm('new')}>+ {t('add')}</Button>}
      </PageHeader>
      <div className="filters">
        <Input
          label={t('search')}
          placeholder={t('equipmentSearch')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select
          label={t('category')}
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title[language]}
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
          <option value="AVAILABLE">{t('available')}</option>
          <option value="ISSUED">{t('issued')}</option>
          <option value="MAINTENANCE">{t('maintenance')}</option>
          <option value="WRITTEN_OFF">{t('writtenOff')}</option>
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
              {item.number}
            </option>
          ))}
        </Select>
      </div>
      <section className="panel catalog-panel" aria-label={t('equipment')}>
        <div className="section-heading">
          <div className="heading-inline">
            <h2>{t('equipment')}</h2>
            <span className="count-label">{filtered.length}</span>
          </div>
          <Button variant="secondary" onClick={() => setNotice(t('exportPending'))}>
            {t('export')}
          </Button>
        </div>
        {visible.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table equipment-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        className="sort-button"
                        type="button"
                        onClick={() => setAscending(!ascending)}
                        aria-label={t('sortName')}
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
                  {visible.map((item) => (
                    <tr key={item.id}>
                      <td data-label={t('equipment')}>
                        <strong>{item.name}</strong>
                        <small>{item.inventoryNumber}</small>
                      </td>
                      <td data-label={t('category')}>
                        {
                          categories.find((category) => category.id === item.categoryId)?.title[
                            language
                          ]
                        }
                      </td>
                      <td data-label={t('room')}>
                        {rooms.find((room) => room.id === item.roomId)?.number}
                      </td>
                      <td data-label={t('status')}>
                        <Status value={item.status} />
                      </td>
                      <td data-label={t('actions')}>
                        <Button
                          variant="text"
                          onClick={() => setSelectedId(item.id)}
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
            <Pagination
              page={currentPage}
              total={filtered.length}
              pageSize={7}
              onChange={setPage}
            />
          </>
        ) : (
          <EmptyState filtered onReset={reset} />
        )}
      </section>
      {form && (
        <EquipmentForm
          item={form === 'new' ? undefined : form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setNotice(t('equipmentSaved'));
          }}
        />
      )}
      {selected && (
        <Dialog title={selected.name} onClose={() => setSelectedId(null)} wide>
          <p className="dialog-subtitle">
            {selected.inventoryNumber} ·{' '}
            {categories.find((item) => item.id === selected.categoryId)?.title[language]}
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
                  <Status value={selected.status} />
                </dd>
              </div>
              <div>
                <dt>{t('room')}</dt>
                <dd>{selected.roomId}</dd>
              </div>
              <div>
                <dt>{t('serialNumber')}</dt>
                <dd>{selected.serialNumber || '—'}</dd>
              </div>
              <div>
                <dt>{t('documents')}</dt>
                <dd>{selected.attachmentName ?? '—'}</dd>
              </div>
            </dl>
          </div>
          <h3>{t('history')}</h3>
          {demo.movements
            .filter((item) => item.equipmentId === selected.id)
            .map((item) => (
              <div key={item.id} className="activity-item">
                <strong>
                  {item.fromRoomId} → {item.toRoomId}
                </strong>
                <small>{date(item.createdAt)}</small>
              </div>
            ))}
          {!demo.movements.some((item) => item.equipmentId === selected.id) && (
            <p className="muted">{t('noMovements')}</p>
          )}
          {canManage && (
            <div className="dialog-actions">
              <Button
                onClick={() => {
                  setForm(selected);
                  setSelectedId(null);
                }}
              >
                {t('edit')}
              </Button>
              <Button
                variant="secondary"
                disabled={selected.status === 'ISSUED'}
                onClick={() => {
                  setMoving(selected);
                  setDestination(rooms.find((room) => room.id !== selected.roomId)?.id ?? '');
                  setSelectedId(null);
                }}
              >
                {t('move')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDeleting(selected);
                  setSelectedId(null);
                }}
              >
                {t('delete')}
              </Button>
            </div>
          )}
        </Dialog>
      )}
      {deleting && (
        <Dialog title={t('deleteTitle')} onClose={() => setDeleting(null)}>
          <p>
            {deleting.name} · {deleting.inventoryNumber}
          </p>
          <p className="muted">{t('deleteNote')}</p>
          <div className="dialog-actions">
            <Button
              variant="danger"
              onClick={() => {
                const ok = demo.deleteEquipment(deleting.id);
                setDeleting(null);
                setNotice(t(ok ? 'equipmentDeleted' : 'linkedEquipment'));
              }}
            >
              {t('delete')}
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      )}
      {moving && (
        <Dialog title={t('move')} onClose={() => setMoving(null)}>
          <p>{moving.name}</p>
          <Select
            label={t('toRoom')}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            {rooms
              .filter((room) => room.id !== moving.roomId)
              .map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} · {room.title[language]}
                </option>
              ))}
          </Select>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                const ok = demo.moveEquipment(moving.id, destination);
                setMoving(null);
                setNotice(t(ok ? 'roomChanged' : 'sameRoom'));
              }}
            >
              {t('confirm')}
            </Button>
            <Button variant="secondary" onClick={() => setMoving(null)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      )}
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    </>
  );
}
