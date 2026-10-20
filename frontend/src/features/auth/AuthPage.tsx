import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Input } from '../../components/Fields';
import type { MessageKey } from '../../i18n/messages';
import { PasswordField } from './PasswordField';
import { publicApi, signIn } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';
type AuthField = 'name' | 'email' | 'password' | 'confirmation';
type AuthValues = Record<AuthField, string>;

const titles: Record<AuthMode, MessageKey> = {
  login: 'signInTitle',
  register: 'registerTitle',
  forgot: 'forgotTitle',
  reset: 'resetTitle',
};

const descriptions: Record<AuthMode, MessageKey> = {
  login: 'signInDescription',
  register: 'registerDescription',
  forgot: 'forgotDescription',
  reset: 'resetDescription',
};

const submitLabels: Record<AuthMode, MessageKey> = {
  login: 'signIn',
  register: 'createAccount',
  forgot: 'getResetLink',
  reset: 'savePassword',
};

function validate(mode: AuthMode, values: AuthValues) {
  const errors: Partial<Record<AuthField, MessageKey>> = {};
  if (mode === 'register') {
    if (!values.name.trim()) errors.name = 'required';
    else if (values.name.trim().length < 2) errors.name = 'nameTooShort';
  }
  if (mode !== 'reset') {
    if (!values.email.trim()) errors.email = 'required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(values.email.trim()))
      errors.email = 'invalidEmail';
  }
  if (mode !== 'forgot') {
    if (!values.password) errors.password = 'required';
    else if (mode !== 'login' && values.password.length < 8) errors.password = 'passwordTooShort';
  }
  if (mode === 'register' || mode === 'reset') {
    if (!values.confirmation) errors.confirmation = 'required';
    else if (values.password !== values.confirmation) errors.confirmation = 'passwordMismatch';
  }
  return errors;
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { t } = usePreferences();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState<AuthValues>({
    name: '',
    email: '',
    password: '',
    confirmation: '',
  });
  const [errors, setErrors] = useState<Partial<Record<AuthField, MessageKey>>>({});
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const invalidResetLink = mode === 'reset' && !searchParams.get('token')?.trim();

  function change(field: AuthField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
    setFailure('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidResetLink || pending) return;
    const nextErrors = validate(mode, values);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      const input = event.currentTarget.elements.namedItem(firstError);
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    setPending(true);
    setFailure('');
    setNotice('');
    try {
      if (mode === 'login') {
        await signIn(values.email.trim(), values.password);
        navigate('/account');
      } else if (mode === 'register') {
        await publicApi('/auth/register', {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        });
        setNotice(t('accountCreated'));
      } else if (mode === 'forgot') {
        await publicApi('/auth/forgot-password', { email: values.email.trim() });
        setNotice(t('resetRequested'));
      } else {
        await publicApi('/auth/reset-password', {
          token: searchParams.get('token'),
          password: values.password,
        });
        setNotice(t('passwordResetDone'));
      }
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setValues((current) => ({ ...current, password: '', confirmation: '' }));
      setPending(false);
    }
  }

  return (
    <section className={mode === 'login' ? 'auth-form-section' : `auth-card auth-card--${mode}`}>
      <header className="auth-heading">
        <h1>{t(titles[mode])}</h1>
        <p>{t(descriptions[mode])}</p>
      </header>
      {invalidResetLink ? (
        <div className="auth-invalid-link" role="alert">
          <p>{t('invalidResetLink')}</p>
          <Link to="/forgot-password">{t('getNewResetLink')} →</Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === 'register' && (
            <Input
              label={t('personalName')}
              name="name"
              value={values.name}
              onChange={(event) => change('name', event.target.value)}
              error={errors.name && t(errors.name)}
              placeholder={t('yourName')}
              autoComplete="name"
              maxLength={100}
              required
            />
          )}
          {mode !== 'reset' && (
            <Input
              label="Email"
              name="email"
              type="email"
              value={values.email}
              onChange={(event) => change('email', event.target.value)}
              error={errors.email && t(errors.email)}
              placeholder="name@college.test"
              autoComplete={mode === 'login' ? 'username' : 'email'}
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              required
            />
          )}
          {mode !== 'forgot' && (
            <PasswordField
              label={t(mode === 'reset' ? 'newPassword' : 'password')}
              name="password"
              value={values.password}
              onChange={(value) => change('password', value)}
              error={errors.password && t(errors.password)}
              placeholder={t(mode === 'login' ? 'enterPassword' : 'passwordHint')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          )}
          {(mode === 'register' || mode === 'reset') && (
            <PasswordField
              label={t('confirmPassword')}
              name="confirmation"
              value={values.confirmation}
              onChange={(value) => change('confirmation', value)}
              error={errors.confirmation && t(errors.confirmation)}
              placeholder={t('repeatPassword')}
              autoComplete="new-password"
            />
          )}
          {mode === 'login' && (
            <Link className="auth-forgot-link" to="/forgot-password">
              {t('forgotPassword')}
            </Link>
          )}
          <Button type="submit" disabled={pending}>
            {t(pending ? 'pleaseWait' : submitLabels[mode])}
          </Button>
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          {notice && (
            <p className="auth-submit-notice" role="status">
              {notice}
            </p>
          )}
        </form>
      )}
      <Link className="auth-next-link" to={mode === 'login' ? '/register' : '/login'}>
        {t(mode === 'login' ? 'registerLink' : mode === 'register' ? 'signInLink' : 'backToSignIn')}{' '}
        →
      </Link>
    </section>
  );
}
