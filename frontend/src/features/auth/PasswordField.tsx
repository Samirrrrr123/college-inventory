import { useState } from 'react';
import { usePreferences } from '../../app/Preferences';
import { Input } from '../../components/Fields';

export function PasswordField({
  label,
  name,
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const { t } = usePreferences();

  return (
    <div className="password-control">
      <Input
        label={label}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={128}
        required
      />
      <button
        className="password-toggle"
        type="button"
        aria-label={`${t(visible ? 'hidePassword' : 'showPassword')}: ${label}`}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {t(visible ? 'hide' : 'show')}
      </button>
    </div>
  );
}
