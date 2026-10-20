import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePreferences } from '../../app/Preferences';
import { useDemo } from '../../demo/DemoProvider';
import { Input, Select } from '../../components/Fields';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';
import { EquipmentPicker } from './EquipmentPicker';
import type { EquipmentRequest } from '../../domain/types';

export function IssueForm({
  request,
  onClose,
  onSaved,
}: {
  request?: EquipmentRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = usePreferences();
  const { requests, loans, people, issueLoan } = useDemo();
  const [requestId, setRequestId] = useState(request?.id ?? '');
  const [personId, setPersonId] = useState(
    request?.personId ?? people.find((item) => !item.blocked && item.role === 'TEACHER')?.id ?? '',
  );
  const [equipmentIds, setEquipmentIds] = useState<string[]>(request?.equipmentIds ?? []);
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const availableRequests = requests.filter(
    (item) => item.status === 'APPROVED' && !loans.some((loan) => loan.requestId === item.id),
  );
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = issueLoan({ equipmentIds, personId, dueDate, requestId: requestId || null });
    if (result !== 'saved') {
      setError(t(result));
      return;
    }
    onSaved();
  }

  return (
    <Dialog title={t('issue')} onClose={onClose} wide>
      <form className="form-stack" noValidate onSubmit={submit}>
        <Select
          label={t('issueRequest')}
          value={requestId}
          onChange={(event) => {
            const next = requests.find((item) => item.id === event.target.value);
            setRequestId(next?.id ?? '');
            setEquipmentIds(next?.equipmentIds ?? []);
            if (next) setPersonId(next.personId);
            setError('');
          }}
        >
          <option value="">{t('directIssue')}</option>
          {availableRequests.map((item) => (
            <option key={item.id} value={item.id}>
              {item.number} · {people.find((person) => person.id === item.personId)?.name}
            </option>
          ))}
        </Select>
        <div className="form-grid">
          <Select
            label={t('borrower')}
            value={personId}
            disabled={!!requestId}
            onChange={(event) => setPersonId(event.target.value)}
          >
            <option value="">{t('invalidRecipient')}</option>
            {people
              .filter((item) => !item.blocked)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </Select>
          <Input
            type="date"
            label={t('returnBy')}
            value={dueDate}
            min={today}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
        </div>
        <EquipmentPicker value={equipmentIds} onChange={setEquipmentIds} locked={!!requestId} />
        <p className="muted small-text">{t('issueWholeSet')}</p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit">{t('issue')}</Button>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
