import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePreferences } from '../../app/Preferences';
import { useDemo } from '../../demo/DemoProvider';
import { Input, Select } from '../../components/Fields';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import type { Person, Role } from '../../domain/types';

export function PersonForm({
  item,
  onSaved,
  onClose,
}: {
  item?: Person;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  const { savePerson } = useDemo();
  const [name, setName] = useState(item?.name ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [role, setRole] = useState<Role>(item?.role ?? 'TEACHER');
  const [blocked, setBlocked] = useState(item?.blocked ?? false);
  const [errors, setErrors] = useState({ name: '', email: '' });
  const [error, setError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      name: name.trim().length >= 2 ? '' : t('nameTooShort'),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim()) ? '' : t('invalidEmail'),
    };
    setErrors(next);
    setError('');
    if (next.name || next.email) return;
    const result = savePerson({ name: name.trim(), email: email.trim(), role, blocked }, item?.id);
    if (result !== 'saved') {
      setError(t(result));
      return;
    }
    onSaved();
  }

  return (
    <Dialog title={t(item ? 'editUser' : 'addUser')} onClose={onClose}>
      <form className="form-stack" noValidate onSubmit={submit}>
        <Input
          label={t('personalName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          maxLength={100}
          autoComplete="name"
          required
          autoFocus
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          maxLength={254}
          autoComplete="email"
          required
        />
        <Select
          label={t('role')}
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          <option value="TEACHER">{t('teacher')}</option>
          <option value="LAB_ASSISTANT">{t('assistant')}</option>
          <option value="ADMIN">{t('admin')}</option>
        </Select>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={blocked}
            onChange={(event) => setBlocked(event.target.checked)}
          />
          <span>{t('blockAccount')}</span>
        </label>
        <p className="muted small-text">{t('personDemoHint')}</p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit">{t('save')}</Button>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
