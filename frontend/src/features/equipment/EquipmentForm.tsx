import { useState } from 'react';
import type { FormEvent } from 'react';
import { useDemo } from '../../demo/DemoProvider';
import { usePreferences } from '../../app/Preferences';
import type { Equipment, EquipmentInput, EquipmentStatus } from '../../domain/types';
import { Button } from '../../components/Button';
import { Input, Select } from '../../components/Fields';
import { Dialog } from '../../components/Dialog';

export function EquipmentForm({
  item,
  onClose,
  onSaved,
}: {
  item?: Equipment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, language } = usePreferences();
  const { rooms, categories, saveEquipment } = useDemo();
  const [values, setValues] = useState<EquipmentInput>(() => ({
    name: item?.name ?? '',
    inventoryNumber: item?.inventoryNumber ?? '',
    serialNumber: item?.serialNumber ?? '',
    categoryId: item?.categoryId ?? categories[0].id,
    roomId: item?.roomId ?? rooms[0].id,
    status: item?.status ?? 'AVAILABLE',
    attachmentName: item?.attachmentName,
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof EquipmentInput | 'file', string>>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.name.trim()) nextErrors.name = t('required');
    if (!values.inventoryNumber.trim()) nextErrors.inventoryNumber = t('required');
    if (errors.file) nextErrors.file = errors.file;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const result = saveEquipment(
      {
        ...values,
        name: values.name.trim(),
        inventoryNumber: values.inventoryNumber.trim(),
        serialNumber: values.serialNumber.trim(),
      },
      item?.id,
    );
    if (result === 'duplicate') {
      setErrors({ inventoryNumber: t('duplicateNumber') });
      return;
    }
    onSaved();
  }

  return (
    <Dialog title={t(item ? 'editEquipment' : 'addEquipment')} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form-stack">
        <Input
          label={`${t('name')} *`}
          value={values.name}
          maxLength={160}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          error={errors.name}
          autoFocus
        />
        <div className="form-grid">
          <Input
            label={`${t('inventoryNumber')} *`}
            value={values.inventoryNumber}
            maxLength={60}
            onChange={(event) => setValues({ ...values, inventoryNumber: event.target.value })}
            error={errors.inventoryNumber}
          />
          <Select
            label={t('category')}
            value={values.categoryId}
            onChange={(event) => setValues({ ...values, categoryId: event.target.value })}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title[language]}
              </option>
            ))}
          </Select>
        </div>
        <div className="form-grid">
          <Select
            label={t('room')}
            value={values.roomId}
            onChange={(event) => setValues({ ...values, roomId: event.target.value })}
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.number} · {room.title[language]}
              </option>
            ))}
          </Select>
          <Select
            label={t('status')}
            value={values.status}
            disabled={item?.status === 'ISSUED'}
            onChange={(event) =>
              setValues({ ...values, status: event.target.value as EquipmentStatus })
            }
          >
            <option value="AVAILABLE">{t('available')}</option>
            <option value="MAINTENANCE">{t('maintenance')}</option>
            <option value="WRITTEN_OFF">{t('writtenOff')}</option>
            {item?.status === 'ISSUED' && <option value="ISSUED">{t('issued')}</option>}
          </Select>
        </div>
        <Input
          label={t('serialNumber')}
          value={values.serialNumber}
          maxLength={100}
          onChange={(event) => setValues({ ...values, serialNumber: event.target.value })}
        />
        <div className="upload-field">
          <Input
            label={t('upload')}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            error={errors.file}
            onChange={(event) => {
              const file = event.target.files?.[0];
              const error =
                file && !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
                  ? t('fileTypeError')
                  : file && file.size > 5 * 1024 * 1024
                    ? t('fileSizeError')
                    : undefined;
              setErrors({ ...errors, file: error });
              setValues({ ...values, attachmentName: error ? undefined : file?.name });
            }}
          />
          <p>{t('uploadHint')}</p>
          {values.attachmentName && (
            <p>
              {t('selectedFile')}: {values.attachmentName}
            </p>
          )}
        </div>
        <div className="dialog-actions">
          <Button type="submit">{t('save')}</Button>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
