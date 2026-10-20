import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { PasswordField } from './PasswordField';

export function ChangePasswordForm({ onClose }: { onClose: () => void }) {
  const { t } = usePreferences();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState({ current: '', password: '', confirmation: '' });
  const [notice, setNotice] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
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
        {notice && (
          <p className="auth-submit-notice" role="status">
            {t('authUnavailable')}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit">{t('savePassword')}</Button>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
