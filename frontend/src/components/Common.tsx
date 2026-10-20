import type { ReactNode } from 'react';
import type { EquipmentStatus, RequestStatus, Role } from '../domain/types';
import { usePreferences } from '../app/Preferences';
import type { MessageKey } from '../i18n/messages';
import { Button } from './Button';

const labels: Record<EquipmentStatus | RequestStatus | Role, MessageKey> = {
  AVAILABLE: 'available',
  ISSUED: 'issued',
  MAINTENANCE: 'maintenance',
  WRITTEN_OFF: 'writtenOff',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ADMIN: 'admin',
  LAB_ASSISTANT: 'assistant',
  TEACHER: 'teacher',
};

export function Status({ value }: { value: EquipmentStatus | RequestStatus }) {
  const { t } = usePreferences();
  return <span className={`badge badge--${value.toLowerCase()}`}>{t(labels[value])}</span>;
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function EmptyState({
  filtered = false,
  onReset,
}: {
  filtered?: boolean;
  onReset?: () => void;
}) {
  const { t } = usePreferences();
  return (
    <div className="empty-state">
      <h3>{t(filtered ? 'noResults' : 'empty')}</h3>
      <p>{t(filtered ? 'noResultsNote' : 'emptyNote')}</p>
      {onReset && (
        <Button variant="secondary" onClick={onReset}>
          {t('resetFilters')}
        </Button>
      )}
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={value === item.value ? 'tab active' : 'tab'}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const { t } = usePreferences();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <div className="pagination">
      <span>
        {t('shown')} {first}–{Math.min(page * pageSize, total)} {t('of')} {total}
      </span>
      <div>
        <Button
          variant="secondary"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label={t('previous')}
        >
          ←
        </Button>
        <span aria-live="polite">
          {t('page')} {page} {t('of')} {pages}
        </span>
        <Button
          variant="secondary"
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          aria-label={t('next')}
        >
          →
        </Button>
      </div>
    </div>
  );
}

export function Notice({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { t } = usePreferences();
  return (
    <div className="notice" role="status">
      <span>{children}</span>
      <button type="button" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
    </div>
  );
}
