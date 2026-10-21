import { useState } from 'react';
import { queryString, statuses } from '../../api/catalog';
import type { SelectedEquipment } from '../../api/circulation';
import { usePreferences } from '../../app/Preferences';
import { Input } from '../../components/Fields';
import { Pagination, Status } from '../../components/Common';
import { ApiFeedback } from '../catalog/ApiFeedback';
import { useApiList } from '../catalog/useApiList';
import { useDebouncedValue } from '../catalog/useDebouncedValue';

export function LiveEquipmentPicker({
  value,
  onChange,
  allowIssued = false,
  disabled = false,
}: {
  value: SelectedEquipment[];
  onChange: (items: SelectedEquipment[]) => void;
  allowIssued?: boolean;
  disabled?: boolean;
}) {
  const { t } = usePreferences();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const list = useApiList<SelectedEquipment>(
    `/equipment?${queryString({ search: term, page, pageSize: 8, sort: 'name', order: 'asc' })}`,
    revision,
  );
  return (
    <fieldset className="equipment-picker" disabled={disabled}>
      <legend>
        {t('equipmentSelection')} · {t('selectedCount')}: {value.length}/20
      </legend>
      <Input
        label={t('selectionSearch')}
        value={search}
        maxLength={200}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
      />
      {value.length > 0 && (
        <p className="muted small-text">{value.map((item) => item.name).join(', ')}</p>
      )}
      <ApiFeedback
        loading={list.loading}
        error={list.error}
        onRetry={() => setRevision((current) => current + 1)}
      />
      {!list.loading && !list.error && list.result && (
        <>
          <div className="equipment-options">
            {list.result.data.map((item) => {
              const selected = value.some((entry) => entry.id === item.id);
              const available =
                item.status === 'available' || (allowIssued && item.status === 'issued');
              return (
                <label className="equipment-option" key={item.id}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && (!available || value.length >= 20)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...value, item]
                          : value.filter((entry) => entry.id !== item.id),
                      )
                    }
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.inventoryNumber}</small>
                  </span>
                  <Status value={statuses[item.status]} />
                </label>
              );
            })}
            {!list.result.data.length && <p className="muted small-text">{t('noResults')}</p>}
          </div>
          <Pagination page={page} pageSize={8} total={list.result.total} onChange={setPage} />
        </>
      )}
    </fieldset>
  );
}
