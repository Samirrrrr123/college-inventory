import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api/client';
import type { CategoryRecord, RoomRecord } from '../../api/catalog';
import { errorMessage } from '../../api/errorMessage';
import { usePreferences } from '../../app/Preferences';
import { Input } from '../../components/Fields';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';

type Props = { onClose: () => void; onSaved: () => void } & (
  { kind: 'rooms'; item?: RoomRecord } | { kind: 'categories'; item?: CategoryRecord }
);

export function CatalogDirectoryForm(props: Props) {
  const { t } = usePreferences();
  const room = props.kind === 'rooms' ? props.item : undefined;
  const [values, setValues] = useState({
    name: props.item?.name ?? '',
    number: room?.number ?? '',
    building: room?.building ?? '',
    floor: String(room?.floor ?? 1),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [pending, setPending] = useState(false);
  const isRoom = props.kind === 'rooms';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = t('required');
    if (isRoom) {
      if (!values.number.trim()) next.number = t('required');
      if (!values.building.trim()) next.building = t('required');
      const floor = Number(values.floor);
      if (!values.floor.trim() || !Number.isInteger(floor) || floor < -5 || floor > 100)
        next.floor = t('invalidFloor');
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    setFailure('');
    const input = {
      name: values.name.trim(),
      ...(isRoom
        ? {
            number: values.number.trim(),
            building: values.building.trim(),
            floor: Number(values.floor),
          }
        : {}),
    };
    try {
      await api(
        `/${props.kind}${props.item ? `/${props.item.id}` : ''}`,
        props.item ? 'PATCH' : 'POST',
        input,
      );
      props.onSaved();
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={t(
        isRoom
          ? props.item
            ? 'editRoom'
            : 'addRoom'
          : props.item
            ? 'editCategory'
            : 'addCategory',
      )}
      onClose={props.onClose}
    >
      <form className="form-stack" noValidate onSubmit={submit}>
        {isRoom && (
          <Input
            label={t('roomNumber')}
            value={values.number}
            maxLength={30}
            onChange={(event) => setValues({ ...values, number: event.target.value })}
            error={errors.number}
            autoFocus
            required
          />
        )}
        <Input
          label={t('name')}
          value={values.name}
          maxLength={100}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          error={errors.name}
          autoFocus={!isRoom}
          required
        />
        {isRoom && (
          <div className="form-grid">
            <Input
              label={t('building')}
              value={values.building}
              maxLength={100}
              onChange={(event) => setValues({ ...values, building: event.target.value })}
              error={errors.building}
              required
            />
            <Input
              label={t('floor')}
              type="number"
              min={-5}
              max={100}
              step={1}
              value={values.floor}
              onChange={(event) => setValues({ ...values, floor: event.target.value })}
              error={errors.floor}
              required
            />
          </div>
        )}
        <p className="muted small-text">{t('dataNotTranslated')}</p>
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit" disabled={pending}>
            {t(pending ? 'pleaseWait' : 'save')}
          </Button>
          <Button variant="secondary" onClick={props.onClose} disabled={pending}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
