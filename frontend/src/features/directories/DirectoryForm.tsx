import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePreferences } from '../../app/Preferences';
import { useDemo } from '../../demo/DemoProvider';
import { Input } from '../../components/Fields';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import type { Category, Room } from '../../domain/types';

type Props = { onClose: () => void; onSaved: () => void } & (
  { kind: 'room'; item?: Room } | { kind: 'category'; item?: Category }
);

export function DirectoryForm(props: Props) {
  const { t, language } = usePreferences();
  const { saveRoom, saveCategory } = useDemo();
  const [name, setName] = useState(props.item?.title[language] ?? '');
  const [number, setNumber] = useState(props.kind === 'room' ? (props.item?.number ?? '') : '');
  const [location, setLocation] = useState(
    props.kind === 'room' ? (props.item?.location[language] ?? '') : '',
  );
  const [errors, setErrors] = useState({ name: '', number: '', location: '' });
  const [error, setError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      name: name.trim() ? '' : t('required'),
      number: props.kind === 'room' && !number.trim() ? t('required') : '',
      location: props.kind === 'room' && !location.trim() ? t('required') : '',
    };
    setErrors(next);
    setError('');
    if (Object.values(next).some(Boolean)) return;
    const title =
      props.item && name.trim() === props.item.title[language]
        ? props.item.title
        : { ru: name.trim(), en: name.trim() };
    const result =
      props.kind === 'room'
        ? saveRoom(
            {
              number: number.trim(),
              title,
              location:
                props.item && location.trim() === props.item.location[language]
                  ? props.item.location
                  : { ru: location.trim(), en: location.trim() },
            },
            props.item?.id,
          )
        : saveCategory({ title }, props.item?.id);
    if (result !== 'saved') {
      setError(t(result));
      return;
    }
    props.onSaved();
  }

  return (
    <Dialog
      title={t(
        props.kind === 'room'
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
        {props.kind === 'room' && (
          <Input
            label={t('roomNumber')}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            error={errors.number}
            maxLength={20}
            required
            autoFocus
          />
        )}
        <Input
          label={t('name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          maxLength={120}
          required
          autoFocus={props.kind === 'category'}
        />
        {props.kind === 'room' && (
          <Input
            label={t('location')}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            error={errors.location}
            placeholder={t('locationHint')}
            maxLength={160}
            required
          />
        )}
        <p className="muted small-text">{t('dataNotTranslated')}</p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit">{t('save')}</Button>
          <Button variant="secondary" onClick={props.onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
