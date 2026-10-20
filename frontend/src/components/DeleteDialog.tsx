import { useState } from 'react';
import { usePreferences } from '../app/Preferences';
import { Button } from './Button';
import { Dialog } from './Dialog';
import type { MessageKey } from '../i18n/messages';

export function DeleteDialog({
  title,
  name,
  onDelete,
  onDeleted,
  onClose,
}: {
  title: string;
  name: string;
  onDelete: () => MessageKey;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const [error, setError] = useState('');
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="detail-title">{name}</p>
      <p className="muted">{t('directoryDeleteNote')}</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button
          variant="danger"
          onClick={() => {
            const result = onDelete();
            if (result === 'deleted') onDeleted();
            else setError(t(result));
          }}
        >
          {t('delete')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </Dialog>
  );
}
