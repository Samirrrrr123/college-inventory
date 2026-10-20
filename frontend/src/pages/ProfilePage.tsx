import { useState } from 'react';
import { usePreferences } from '../app/Preferences';
import { useDemo } from '../demo/DemoProvider';
import { Button } from '../components/Button';
import { Input } from '../components/Fields';
import { Notice, PageHeader } from '../components/Common';
import { AppearanceSettings } from '../features/preferences/AppearanceSettings';
import type { Person } from '../domain/types';

function ProfileForm({
  person,
  onNotice,
}: {
  person: Person;
  onNotice: (message: string) => void;
}) {
  const { t } = usePreferences();
  const { updateProfile } = useDemo();
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email);
  const [errors, setErrors] = useState({ name: '', email: '' });
  const initials = person.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
  const role =
    person.role === 'ADMIN'
      ? t('admin')
      : person.role === 'LAB_ASSISTANT'
        ? t('assistant')
        : t('teacher');

  return (
    <section className="panel personal-panel">
      <div className="profile-identity">
        <div className="avatar">{initials}</div>
        <div>
          <h2>{person.name}</h2>
          <p className="muted small-text">
            {role} · {t('collegeEquipment')}
          </p>
        </div>
      </div>
      <form
        className="form-stack profile-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const next = {
            name: name.trim() ? '' : t('required'),
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? '' : t('invalidEmail'),
          };
          setErrors(next);
          if (next.name || next.email) return;
          updateProfile(name.trim(), email.trim());
          onNotice(t('profileSaved'));
        }}
      >
        <Input
          label={t('personalName')}
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <Button type="submit">{t('saveChanges')}</Button>
      </form>
      <div className="security-section">
        <h2>{t('security')}</h2>
        <p className="muted small-text">{t('passwordNote')}</p>
        <Button variant="secondary" onClick={() => onNotice(t('backendPending'))}>
          {t('changePassword')}
        </Button>
      </div>
    </section>
  );
}

export function ProfilePage() {
  const { t, date } = usePreferences();
  const { person, audit } = useDemo();
  const [notice, setNotice] = useState('');
  return (
    <>
      <PageHeader title={t('profile')} subtitle={t('profileSubtitle')} />
      <div className="profile-grid">
        <ProfileForm key={person.id} person={person} onNotice={setNotice} />
        <div className="profile-right">
          <AppearanceSettings />
          <section className="panel">
            <h2>{t('recentActivity')}</h2>
            {audit
              .filter((item) => item.actor === person.name)
              .slice(0, 3)
              .map((item) => (
                <div className="activity-item" key={item.id}>
                  <strong>
                    {t(item.action)} · {item.subject}
                  </strong>
                  <small>{date(item.createdAt)}</small>
                </div>
              ))}
            {!audit.some((item) => item.actor === person.name) && (
              <p className="muted">{t('empty')}</p>
            )}
          </section>
        </div>
      </div>
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    </>
  );
}
