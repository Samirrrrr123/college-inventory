import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePreferences } from '../../app/Preferences';
import { useDemo } from '../../demo/DemoProvider';
import { Input } from '../../components/Fields';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';
import { EquipmentPicker } from './EquipmentPicker';

export function RequestForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = usePreferences();
  const { addRequest } = useDemo();
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');
  const [purposeError, setPurposeError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    setPurposeError(purpose.trim() ? '' : t('purposeRequired'));
    setError('');
    if (!purpose.trim()) return;
    const result = addRequest({ equipmentIds, purpose: purpose.trim() });
    if (result !== 'saved') {
      setError(t(result));
      return;
    }
    onSaved();
  }

  return (
    <Dialog title={t('newRequest')} onClose={onClose} wide>
      <form className="form-stack" noValidate onSubmit={submit}>
        <Input
          label={t('purpose')}
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          error={purposeError}
          maxLength={300}
          required
          autoFocus
        />
        <EquipmentPicker value={equipmentIds} onChange={setEquipmentIds} allowIssued />
        <p className="muted small-text">{t('noReservation')}</p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit">{t('sendRequest')}</Button>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
