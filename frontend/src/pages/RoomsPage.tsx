import { useState } from 'react';
import { usePreferences } from '../app/Preferences';
import { useDemo } from '../demo/DemoProvider';
import { Button } from '../components/Button';
import { Input } from '../components/Fields';
import { Dialog } from '../components/Dialog';
import { EmptyState, Notice, PageHeader, Status, Tabs } from '../components/Common';
import { DirectoryForm } from '../features/directories/DirectoryForm';
import { DeleteDialog } from '../components/DeleteDialog';
import type { Room } from '../domain/types';

export function RoomsPage() {
  const { t, language, date } = usePreferences();
  const demo = useDemo();
  const [tab, setTab] = useState<'rooms' | 'inventory' | 'movements'>('rooms');
  const [search, setSearch] = useState('');
  const [roomId, setRoomId] = useState('204');
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [roomForm, setRoomForm] = useState<{ item?: Room } | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const rooms = demo.rooms.filter((item) =>
    `${item.number} ${item.title[language]}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const room = demo.rooms.find((item) => item.id === roomId) ?? demo.rooms[0];
  const equipment = demo.equipment.filter((item) => item.roomId === room.id);
  const present = equipment.filter(
    (item) => item.status !== 'ISSUED' && item.status !== 'WRITTEN_OFF',
  );
  const canManage = demo.person.role !== 'TEACHER';

  function startCheck() {
    setFound(present.map((item) => item.id));
    setChecking(true);
  }

  return (
    <>
      <PageHeader title={t('rooms')} subtitle={t('roomsSubtitle')}>
        {canManage && <Button onClick={() => setRoomForm({})}>+ {t('addRoom')}</Button>}
      </PageHeader>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'rooms', label: t('rooms') },
          { value: 'inventory', label: t('inventory') },
          { value: 'movements', label: t('movements') },
        ]}
      />
      {tab === 'rooms' && (
        <div className="rooms-grid">
          <section className="panel room-list">
            <Input
              label={t('search')}
              placeholder={t('roomSearch')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {rooms.map((item) => (
              <button
                key={item.id}
                className={`room-button ${item.id === room.id ? 'selected' : ''}`}
                type="button"
                onClick={() => setRoomId(item.id)}
              >
                <span className="room-number">{item.number}</span>
                <span>
                  <strong>{item.title[language]}</strong>
                  <small>
                    {demo.equipment.filter((eq) => eq.roomId === item.id).length} ·{' '}
                    {t('totalEquipment')}
                  </small>
                </span>
              </button>
            ))}
            {!rooms.length && <EmptyState filtered />}
          </section>
          <section className="panel room-detail">
            <div className="section-heading">
              <div>
                <h2>
                  {t('room')} {room.number}
                </h2>
                <p className="muted small-text">
                  {room.title[language]} · {room.location[language]}
                </p>
              </div>
              {canManage && (
                <div className="row-actions">
                  <Button variant="text" onClick={() => setRoomForm({ item: room })}>
                    {t('edit')} ↗
                  </Button>
                  <Button variant="text" onClick={() => setDeleting(room)}>
                    {t('delete')}
                  </Button>
                </div>
              )}
            </div>
            <div className="room-stats">
              {[
                [equipment.length, t('tracked')],
                [present.length, t('inStock')],
                [equipment.filter((item) => item.status === 'ISSUED').length, t('issued')],
              ].map(([count, label]) => (
                <div key={label}>
                  <strong>{count}</strong>
                  <small>{label}</small>
                </div>
              ))}
            </div>
            {equipment.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('equipment')}</th>
                      <th>{t('inventoryNumber')}</th>
                      <th>{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((item) => (
                      <tr key={item.id}>
                        <td data-label={t('equipment')}>
                          <strong>{item.name}</strong>
                        </td>
                        <td data-label={t('inventoryNumber')}>{item.inventoryNumber}</td>
                        <td data-label={t('status')}>
                          <Status value={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
            <div className="room-check">
              <h3>{t('inventory')}</h3>
              <p className="muted small-text">
                {demo.checks[room.id]
                  ? `${t('lastCheck')}: ${date(demo.checks[room.id].date)} · ${t('found')}: ${demo.checks[room.id].found}`
                  : t('noChecks')}
              </p>
              {canManage && (
                <Button variant="secondary" onClick={startCheck}>
                  {t('startCheck')}
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
      {tab === 'inventory' && (
        <section className="panel">
          <h2>{t('inventory')}</h2>
          {Object.keys(demo.checks).length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('room')}</th>
                    <th>{t('date')}</th>
                    <th>{t('found')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(demo.checks).map(([id, check]) => (
                    <tr key={id}>
                      <td data-label={t('room')}>
                        {demo.rooms.find((item) => item.id === id)?.number ?? id}
                      </td>
                      <td data-label={t('date')}>{date(check.date)}</td>
                      <td data-label={t('found')}>{check.found}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      )}
      {tab === 'movements' && (
        <section className="panel">
          <h2>{t('movements')}</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('equipment')}</th>
                  <th>{t('fromRoom')}</th>
                  <th>{t('toRoom')}</th>
                  <th>{t('date')}</th>
                </tr>
              </thead>
              <tbody>
                {demo.movements.map((item) => (
                  <tr key={item.id}>
                    <td data-label={t('equipment')}>
                      {demo.equipment.find((eq) => eq.id === item.equipmentId)?.name}
                    </td>
                    <td data-label={t('fromRoom')}>
                      {demo.rooms.find((room) => room.id === item.fromRoomId)?.number ??
                        item.fromRoomId}
                    </td>
                    <td data-label={t('toRoom')}>
                      {demo.rooms.find((room) => room.id === item.toRoomId)?.number ??
                        item.toRoomId}
                    </td>
                    <td data-label={t('date')}>{date(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {checking && (
        <Dialog title={`${t('checkTitle')} · ${room.number}`} onClose={() => setChecking(false)}>
          <p className="muted">{t('checkHint')}</p>
          <div className="check-list">
            {equipment
              .filter((item) => item.status !== 'WRITTEN_OFF')
              .map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={found.includes(item.id)}
                    onChange={(event) =>
                      setFound(
                        event.target.checked
                          ? [...found, item.id]
                          : found.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span>
                    {item.name}
                    <small>{item.inventoryNumber}</small>
                  </span>
                </label>
              ))}
          </div>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                demo.completeCheck(room.id, found.length);
                setChecking(false);
                setNotice(t('checkSaved'));
              }}
            >
              {t('completeCheck')}
            </Button>
            <Button variant="secondary" onClick={() => setChecking(false)}>
              {t('cancel')}
            </Button>
          </div>
        </Dialog>
      )}
      {roomForm && (
        <DirectoryForm
          kind="room"
          item={roomForm.item}
          onClose={() => setRoomForm(null)}
          onSaved={() => {
            setRoomForm(null);
            setNotice(t('roomSaved'));
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          title={t('deleteRoom')}
          name={`${deleting.number} · ${deleting.title[language]}`}
          onDelete={() => demo.deleteRoom(deleting.id)}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setNotice(t('directoryDeleted'));
          }}
        />
      )}
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    </>
  );
}
