import { useState } from 'react';
import { queryString } from '../../api/catalog';
import type { Recipient } from '../../api/circulation';
import { usePreferences } from '../../app/Preferences';
import { Input, Select } from '../../components/Fields';
import { Pagination } from '../../components/Common';
import { ApiFeedback } from '../catalog/ApiFeedback';
import { useApiList } from '../catalog/useApiList';
import { useDebouncedValue } from '../catalog/useDebouncedValue';

export function RecipientPicker({
  value,
  onChange,
}: {
  value: Recipient | null;
  onChange: (person: Recipient | null) => void;
}) {
  const { t } = usePreferences();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const list = useApiList<Recipient>(
    `/loan-recipients?${queryString({ search: term, page, pageSize: 10 })}`,
    revision,
  );
  return (
    <div className="form-stack">
      <Input
        label={t('recipientSearch')}
        value={search}
        maxLength={200}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      <ApiFeedback
        loading={list.loading}
        error={list.error}
        onRetry={() => setRevision((current) => current + 1)}
      />
      <Select
        label={t('borrower')}
        value={value?.id ?? ''}
        onChange={(event) =>
          onChange(list.result?.data.find((person) => person.id === event.target.value) ?? null)
        }
        required
      >
        <option value="">{t('chooseRecipient')}</option>
        {value && !list.result?.data.some((person) => person.id === value.id) && (
          <option value={value.id}>
            {value.name} · {value.email}
          </option>
        )}
        {list.result?.data.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name} · {person.email}
          </option>
        ))}
      </Select>
      {list.result && (
        <Pagination page={page} pageSize={10} total={list.result.total} onChange={setPage} />
      )}
    </div>
  );
}
