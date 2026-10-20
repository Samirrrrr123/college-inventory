import { useState } from 'react';
import { api } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { usePreferences } from '../../app/Preferences';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';

export function ApiDeleteDialog({
  title,
  name,
  path,
  onClose,
  onDeleted,
}: {
  title: string;
  name: string;
  path: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = usePreferences();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  async function remove() {
    if (pending) return;
    setPending(true);
    setFailure('');
    try {
      await api(path, 'DELETE');
      onDeleted();
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="detail-title">{name}</p>
      <p className="muted">{t('directoryDeleteNote')}</p>
      {failure && (
        <p role="alert" className="field-error">
          {failure}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="danger" onClick={() => void remove()} disabled={pending}>
          {t(pending ? 'pleaseWait' : 'delete')}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          {t('cancel')}
        </Button>
      </div>
    </Dialog>
  );
}
