import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import type { Recipient, RequestRecord, SelectedEquipment } from '../../api/circulation';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Input } from '../../components/Fields';
import { LiveEquipmentPicker } from './LiveEquipmentPicker';
import { RecipientPicker } from './RecipientPicker';

interface FormProps {
  onClose: () => void;
  onSaved: () => void;
}

export function LiveRequestForm({ onClose, onSaved }: FormProps) {
  const { t } = usePreferences();
  const [purpose, setPurpose] = useState('');
  const [items, setItems] = useState<SelectedEquipment[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!purpose.trim()) {
      setError(t('purposeRequired'));
      return;
    }
    if (!items.length) {
      setError(t('chooseEquipment'));
      return;
    }
    setError('');
    setPending(true);
    try {
      await api('/requests', 'POST', {
        purpose: purpose.trim(),
        equipmentIds: items.map((item) => item.id),
      });
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={t('newRequest')}
      onClose={() => {
        if (!pending) onClose();
      }}
      wide
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        <Input
          label={t('purpose')}
          value={purpose}
          maxLength={300}
          onChange={(event) => setPurpose(event.target.value)}
          required
          autoFocus
          disabled={pending}
        />
        <LiveEquipmentPicker value={items} onChange={setItems} allowIssued disabled={pending} />
        <p className="muted small-text">{t('noReservation')}</p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit" disabled={pending}>
            {t(pending ? 'pleaseWait' : 'sendRequest')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function LiveIssueForm({
  request,
  onClose,
  onSaved,
}: FormProps & { request?: RequestRecord }) {
  const { t } = usePreferences();
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [items, setItems] = useState<SelectedEquipment[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const deadline = new Date(`${dueDate}T23:59:59`);
    if (!dueDate || !Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) {
      setError(t('invalidDueDate'));
      return;
    }
    if (!request && !recipient) {
      setError(t('chooseRecipient'));
      return;
    }
    if (!request && !items.length) {
      setError(t('chooseEquipment'));
      return;
    }
    setError('');
    setPending(true);
    try {
      const dueAt = deadline.toISOString();
      await api(
        '/loans',
        'POST',
        request
          ? { kind: 'request', requestId: request.id, dueAt }
          : {
              kind: 'direct',
              recipientId: recipient!.id,
              equipmentIds: items.map((item) => item.id),
              dueAt,
            },
      );
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={t('issue')}
      onClose={() => {
        if (!pending) onClose();
      }}
      wide
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        {request ? (
          <>
            <p>
              {t('requestNumber')} №{request.number} · {request.requester.name}
            </p>
            <p>{request.items.map((item) => item.equipment.name).join(', ')}</p>
          </>
        ) : (
          <RecipientPicker value={recipient} onChange={setRecipient} />
        )}
        <Input
          type="date"
          label={t('returnBy')}
          value={dueDate}
          min={today}
          required
          onChange={(event) => setDueDate(event.target.value)}
          disabled={pending}
        />
        {!request && <LiveEquipmentPicker value={items} onChange={setItems} disabled={pending} />}
        <p className="muted small-text">{t('issueWholeSet')}</p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit" disabled={pending}>
            {t(pending ? 'pleaseWait' : 'issue')}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export interface CirculationAction {
  title: string;
  label: string;
  path: string;
  description: string;
  withNote?: boolean;
}

export function LiveActionDialog({
  action,
  onClose,
  onSaved,
}: FormProps & { action: CirculationAction }) {
  const { t } = usePreferences();
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await api(action.path, 'POST', action.withNote ? { note: note.trim() } : {});
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={action.title}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form className="form-stack" onSubmit={submit}>
        <p>{action.description}</p>
        {action.withNote && (
          <Input
            label={t('decisionNote')}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            disabled={pending}
          />
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit" disabled={pending}>
            {pending ? t('pleaseWait') : action.label}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
