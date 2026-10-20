import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { PasswordField } from './PasswordField';
import { api, clearSession } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';

export function ChangePasswordForm({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { t } = usePreferences();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState({ current: '', password: '', confirmation: '' });
  const [notice, setNotice] = useState(false);
  const [failure, setFailure] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setNotice(false);
    const next = {
      current: current ? '' : t('required'),
      password:
        password.length < 8
          ? t('passwordTooShort')
          : password === current
            ? t('passwordUnchanged')
            : '',
      confirmation: confirmation && confirmation === password ? '' : t('passwordMismatch'),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    if (onChanged) {
      setPending(true);
      setFailure('');
      try {
        await api('/me/password', 'PATCH', { currentPassword: current, password });
        clearSession();
        onChanged();
      } catch (error) {
        setFailure(errorMessage(error, t));
      } finally {
        setCurrent('');
        setPassword('');
        setConfirmation('');
        setPending(false);
      }
      return;
    }
    setCurrent('');
    setPassword('');
    setConfirmation('');
    setNotice(true);
  }

  return (
    <Dialog title={t('changePassword')} onClose={onClose}>
      <form className="form-stack" noValidate onSubmit={submit}>
        <PasswordField
          label={t('currentPassword')}
          name="currentPassword"
          value={current}
          onChange={(value) => {
            setCurrent(value);
            setNotice(false);
          }}
          error={errors.current}
          autoComplete="current-password"
        />
        <PasswordField
          label={t('newPassword')}
          name="newPassword"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setNotice(false);
          }}
          error={errors.password}
          autoComplete="new-password"
        />
        <PasswordField
          label={t('confirmPassword')}
          name="confirmation"
          value={confirmation}
          onChange={(value) => {
            setConfirmation(value);
            setNotice(false);
          }}
          error={errors.confirmation}
          autoComplete="new-password"
        />
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        {notice && (
          <p className="auth-submit-notice" role="status">
            {t('authUnavailable')}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit" disabled={pending}>
            {t(pending ? 'pleaseWait' : 'savePassword')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
