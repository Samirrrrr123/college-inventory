import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api, clearSession } from '../../api/client';
import { queryString } from '../../api/catalog';
import type { Account } from '../../api/catalog';
import { errorMessage } from '../../api/errorMessage';
import { useCurrentAccount } from '../../app/CurrentAccount';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Input, Select } from '../../components/Fields';
import { Dialog } from '../../components/Dialog';
import { PageHeader, Pagination } from '../../components/Common';
import { ApiFeedback } from '../catalog/ApiFeedback';
import { useApiList } from '../catalog/useApiList';
import { useDebouncedValue } from '../catalog/useDebouncedValue';

interface ManagedAccount extends Account {
  isLastAdmin: boolean;
}

export function UsersPage() {
  const account = useCurrentAccount();
  const { t } = usePreferences();
  if (account.role !== 'admin')
    return (
      <section className="panel empty-state">
        <h1>{t('accessDenied')}</h1>
      </section>
    );
  return <UserList />;
}

function AccessForm({
  user,
  onClose,
  onSaved,
}: {
  user: ManagedAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const account = useCurrentAccount();
  const { t } = usePreferences();
  const navigate = useNavigate();
  const [role, setRole] = useState(user.role);
  const [isBlocked, setBlocked] = useState(user.isBlocked);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const changed = role !== user.role || isBlocked !== user.isBlocked;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!changed || pending) return;
    setPending(true);
    setFailure('');
    try {
      await api(`/users/${user.id}`, 'PATCH', { role, isBlocked });
      if (user.id === account.id) {
        clearSession();
        navigate('/login', { replace: true });
      } else onSaved();
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      title={t('editUserAccess')}
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <p className="dialog-subtitle">
        {user.name} · {user.email}
      </p>
      <form onSubmit={(event) => void save(event)}>
        <Select
          label={t('role')}
          value={role}
          disabled={pending || user.isLastAdmin}
          onChange={(event) => setRole(event.target.value as Account['role'])}
        >
          <option value="teacher">{t('teacher')}</option>
          <option value="technician">{t('assistant')}</option>
          <option value="admin">{t('admin')}</option>
        </Select>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={isBlocked}
            disabled={pending || user.isLastAdmin}
            onChange={(event) => setBlocked(event.target.checked)}
          />
          {t('blockAccount')}
        </label>
        <p className="muted small-text">
          {t(
            user.isLastAdmin
              ? 'lastAdmin'
              : user.id === account.id
                ? 'selfAccessHint'
                : 'accessChangeHint',
          )}
        </p>
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit" disabled={pending || !changed}>
            {t(pending ? 'pleaseWait' : 'save')}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function UserList() {
  const { t } = usePreferences();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<ManagedAccount | null>(null);
  const [notice, setNotice] = useState('');
  const list = useApiList<ManagedAccount>(
    `/users?${queryString({ search: term, role, status, sort, order, page, pageSize: 7 })}`,
    revision,
  );
  return (
    <>
      <PageHeader title={t('users')} subtitle={t('usersAccessSubtitle')} />
      {notice && <p role="status">{notice}</p>}
      <div className="filters directory-filters">
        <Input
          label={t('search')}
          placeholder={t('personSearch')}
          value={search}
          maxLength={100}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Select
          label={t('role')}
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allRoles')}</option>
          <option value="teacher">{t('teacher')}</option>
          <option value="technician">{t('assistant')}</option>
          <option value="admin">{t('admin')}</option>
        </Select>
        <Select
          label={t('status')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('allStatuses')}</option>
          <option value="active">{t('active')}</option>
          <option value="blocked">{t('blocked')}</option>
        </Select>
        <Select
          label={t('sortBy')}
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
        >
          <option value="name">{t('personalName')}</option>
          <option value="email">Email</option>
        </Select>
        <Select
          label={t('sortDirection')}
          value={order}
          onChange={(event) => {
            setOrder(event.target.value);
            setPage(1);
          }}
        >
          <option value="asc">↑</option>
          <option value="desc">↓</option>
        </Select>
      </div>
      <section className="panel catalog-panel" aria-label={t('users')} aria-busy={list.loading}>
        <div className="section-heading">
          <h2>{t('users')}</h2>
          <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>
            {t('refreshList')}
          </Button>
        </div>
        <ApiFeedback
          loading={list.loading}
          error={list.error}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {!list.loading && !list.error && list.result && (
          <>
            {!list.result.data.length ? (
              <p className="muted">{t('noResults')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('personalName')}</th>
                      <th>Email</th>
                      <th>{t('role')}</th>
                      <th>{t('status')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.result.data.map((user) => (
                      <tr key={user.id}>
                        <td data-label={t('personalName')}>
                          <strong>{user.name}</strong>
                        </td>
                        <td data-label="Email">{user.email}</td>
                        <td data-label={t('role')}>
                          {t(
                            user.role === 'admin'
                              ? 'admin'
                              : user.role === 'technician'
                                ? 'assistant'
                                : 'teacher',
                          )}
                        </td>
                        <td data-label={t('status')}>
                          <span
                            className={`badge badge--${user.isBlocked ? 'rejected' : 'approved'}`}
                          >
                            {t(user.isBlocked ? 'blocked' : 'active')}
                          </span>
                        </td>
                        <td data-label={t('actions')}>
                          <Button
                            variant="text"
                            aria-label={`${t('editUserAccess')}: ${user.name}`}
                            onClick={() => setSelected(user)}
                          >
                            {t('editUserAccess')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={page} pageSize={7} total={list.result.total} onChange={setPage} />
          </>
        )}
      </section>
      {selected && (
        <AccessForm
          user={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setRevision((value) => value + 1);
            setNotice(t('accessSaved'));
          }}
        />
      )}
    </>
  );
}
