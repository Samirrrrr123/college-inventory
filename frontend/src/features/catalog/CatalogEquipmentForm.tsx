import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type {
  CategoryRecord,
  RoomRecord,
  EquipmentRecord,
  EquipmentValues,
} from '../../api/catalog';
import { errorMessage } from '../../api/errorMessage';
import { usePreferences } from '../../app/Preferences';
import { Input, Select } from '../../components/Fields';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';

export function CatalogEquipmentForm({
  item,
  categories,
  rooms,
  onClose,
  onSaved,
}: {
  item?: EquipmentRecord;
  categories: CategoryRecord[];
  rooms: RoomRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = usePreferences();
  const [values, setValues] = useState({
    name: item?.name ?? '',
    inventoryNumber: item?.inventoryNumber ?? '',
    categoryId: item?.categoryId ?? categories[0]?.id ?? '',
    roomId: item?.roomId ?? rooms[0]?.id ?? '',
    serialNumber: item?.serialNumber ?? '',
    description: item?.description ?? '',
    status: item?.status ?? 'available',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [pending, setPending] = useState(false);
  const issued = item?.status === 'issued';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next: Record<string, string> = {};
    for (const field of ['name', 'inventoryNumber', 'categoryId', 'roomId'] as const) {
      if (!values[field].trim()) next[field] = t('required');
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    setFailure('');
    const input: EquipmentValues = {
      name: values.name.trim(),
      inventoryNumber: values.inventoryNumber.trim(),
      categoryId: values.categoryId,
      roomId: values.roomId,
      serialNumber: values.serialNumber.trim() || null,
      description: values.description.trim(),
      ...(!issued && values.status !== 'issued' ? { status: values.status } : {}),
    };
    try {
      await api(item ? `/equipment/${item.id}` : '/equipment', item ? 'PATCH' : 'POST', input);
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVENTORY_NUMBER_EXISTS')
        setErrors({ inventoryNumber: t('duplicateNumber') });
      else setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog title={t(item ? 'editEquipment' : 'addEquipment')} onClose={onClose}>
      <form className="form-stack" noValidate onSubmit={submit}>
        <Input
          label={`${t('name')} *`}
          value={values.name}
          maxLength={200}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          error={errors.name}
          autoFocus
          required
        />
        <div className="form-grid">
          <Input
            label={`${t('inventoryNumber')} *`}
            value={values.inventoryNumber}
            maxLength={80}
            onChange={(event) => setValues({ ...values, inventoryNumber: event.target.value })}
            error={errors.inventoryNumber}
            required
          />
          <Select
            label={t('category')}
            value={values.categoryId}
            onChange={(event) => setValues({ ...values, categoryId: event.target.value })}
            required
          >
            <option value="" disabled>
              {t('category')}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="form-grid">
          <Select
            label={t('room')}
            value={values.roomId}
            disabled={issued}
            onChange={(event) => setValues({ ...values, roomId: event.target.value })}
            required
          >
            <option value="" disabled>
              {t('room')}
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.number} · {room.name} · {room.building}
              </option>
            ))}
          </Select>
          <Select
            label={t('status')}
            value={values.status}
            disabled={issued}
            onChange={(event) =>
              setValues({ ...values, status: event.target.value as EquipmentRecord['status'] })
            }
          >
            <option value="available">{t('available')}</option>
            <option value="repair">{t('maintenance')}</option>
            <option value="written_off">{t('writtenOff')}</option>
            {issued && <option value="issued">{t('issued')}</option>}
          </Select>
        </div>
        <Input
          label={t('serialNumber')}
          value={values.serialNumber}
          maxLength={100}
          onChange={(event) => setValues({ ...values, serialNumber: event.target.value })}
        />
        <div className="field">
          <label htmlFor="equipment-description">{t('description')}</label>
          <textarea
            id="equipment-description"
            rows={3}
            maxLength={5000}
            value={values.description}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
          />
        </div>
        <p className="muted small-text">{t('uploadNotReady')}</p>
        {failure && (
          <p role="alert" className="field-error">
            {failure}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit" disabled={pending}>
            {t(pending ? 'pleaseWait' : 'save')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
