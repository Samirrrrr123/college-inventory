import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, api, signOut } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Input } from '../../components/Fields';
import { ChangePasswordForm } from './ChangePasswordForm';

interface Account {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'technician' | 'admin';
  isBlocked: boolean;
}
interface Activity {
  id: string;
  action: string;
  createdAt: string;
}

export function AccountPage() {
  const { t, date } = usePreferences();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ data: Account }>('/me'),
      api<{ data: Activity[] }>('/me/activity?pageSize=10'),
    ])
      .then(([profile, history]) => {
        if (!active) return;
        setAccount(profile.data);
        setName(profile.data.name);
        setEmail(profile.data.email);
        setActivity(history.data);
        setFailure('');
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          navigate('/login', { replace: true });
        else setFailure(errorMessage(error, t));
      });
    return () => {
      active = false;
    };
  }, [attempt, navigate, t]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim())) {
      setFailure(t('checkFields'));
      return;
    }
    setPending(true);
    setFailure('');
    setNotice('');
    try {
      const result = await api<{ data: Account }>('/me', 'PATCH', {
        name: name.trim(),
        email: email.trim(),
      });
      setAccount(result.data);
      setNotice(t('profileSaved'));
      setAttempt((value) => value + 1);
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setFailure('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  const actions: Record<string, string> = {
    registered: t('activityRegistered'),
    signedIn: t('activitySignedIn'),
    profileUpdated: t('activityProfileUpdated'),
    passwordChanged: t('activityPasswordChanged'),
    requestCreated: t('activityRequestCreated'),
    requestApproved: t('requestApproved'),
    requestRejected: t('requestRejected'),
    requestCancelled: t('activityRequestCancelled'),
    loanIssued: t('activityLoanIssued'),
    loanReturned: t('activityLoanReturned'),
    equipmentCreated: `${t('equipment')}: ${t('created')}`,
    equipmentUpdated: `${t('equipment')}: ${t('updated')}`,
    equipmentDeleted: `${t('equipment')}: ${t('deleted')}`,
    categoryCreated: `${t('category')}: ${t('created')}`,
    categoryUpdated: `${t('category')}: ${t('updated')}`,
    categoryDeleted: `${t('category')}: ${t('deleted')}`,
    roomCreated: `${t('room')}: ${t('created')}`,
    roomUpdated: `${t('room')}: ${t('updated')}`,
    roomDeleted: `${t('room')}: ${t('deleted')}`,
  };

  return (
    <section className="auth-card account-card">
      <header className="auth-heading">
        <h1>{t('accountTitle')}</h1>
        <p>{t('accountDescription')}</p>
      </header>
      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}
      {!account ? (
        failure ? (
          <Button onClick={() => setAttempt((value) => value + 1)}>{t('tryAgain')}</Button>
        ) : (
          <p role="status">{t('pleaseWait')}</p>
        )
      ) : (
        <>
          <p className="account-role">
            {t(
              account.role === 'admin'
                ? 'admin'
                : account.role === 'technician'
                  ? 'assistant'
                  : 'teacher',
            )}
          </p>
          <form className="form-stack" onSubmit={save} noValidate>
            <Input
              label={t('personalName')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={100}
              autoComplete="name"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              autoComplete="email"
              required
            />
            <Button type="submit" disabled={pending}>
              {t(pending ? 'pleaseWait' : 'saveChanges')}
            </Button>
          </form>
          {notice && <p role="status">{notice}</p>}
          <div className="account-actions">
            <Button
              variant="secondary"
              onClick={() => setChangingPassword(true)}
              disabled={pending}
            >
              {t('changePassword')}
            </Button>
            <Button variant="secondary" onClick={() => void logout()} disabled={pending}>
              {t('signOut')}
            </Button>
          </div>
          <section className="security-section">
            <h2>{t('recentActivity')}</h2>
            {activity.length ? (
              <ul className="account-activity">
                {activity.map((entry) => (
                  <li key={entry.id}>
                    <span>{actions[entry.action] ?? entry.action}</span>
                    <time dateTime={entry.createdAt}>{date(entry.createdAt)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('noActivity')}</p>
            )}
          </section>
          {changingPassword && (
            <ChangePasswordForm
              onClose={() => setChangingPassword(false)}
              onChanged={() => navigate('/login?passwordChanged=1', { replace: true })}
            />
          )}
        </>
      )}
      <Link className="button button--primary" to="/app/equipment">
        {t('catalogAccess')}
      </Link>
      <p className="muted small-text">{t('operationsPending')}</p>
      <Link className="auth-next-link" to="/">
        {t('openDemo')} →
      </Link>
    </section>
  );
}
