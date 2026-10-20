import { usePreferences } from '../../app/Preferences';
import { errorMessage } from '../../api/errorMessage';
import { Button } from '../../components/Button';

export function ApiFeedback({
  error,
  loading,
  onRetry,
}: {
  error: unknown;
  loading: boolean;
  onRetry: () => void;
}) {
  const { t } = usePreferences();
  if (loading)
    return (
      <div className="empty-state" role="status">
        {t('pleaseWait')}
      </div>
    );
  if (error)
    return (
      <div className="empty-state">
        <p className="field-error" role="alert">
          {errorMessage(error, t)}
        </p>
        <Button variant="secondary" onClick={onRetry}>
          {t('tryAgain')}
        </Button>
      </div>
    );
  return null;
}
