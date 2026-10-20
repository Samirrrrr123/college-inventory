import { useState } from 'react';
import { usePreferences } from '../../app/Preferences';
import { useDemo } from '../../demo/DemoProvider';
import { Input } from '../../components/Fields';
import { Status } from '../../components/Common';

export function EquipmentPicker({
  value,
  onChange,
  locked = false,
  allowIssued = false,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  locked?: boolean;
  allowIssued?: boolean;
}) {
  const { t } = usePreferences();
  const { equipment } = useDemo();
  const [search, setSearch] = useState('');
  const items = equipment.filter((item) =>
    locked
      ? value.includes(item.id)
      : `${item.name} ${item.inventoryNumber}`
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <fieldset className="equipment-picker">
      <legend>
        {t('equipmentSelection')} · {t('selectedCount')}: {value.length}
      </legend>
      {!locked && (
        <Input
          label={t('selectionSearch')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      <div className="equipment-options">
        {items.map((item) => (
          <label key={item.id} className="equipment-option">
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              disabled={
                locked ||
                !(item.status === 'AVAILABLE' || (allowIssued && item.status === 'ISSUED'))
              }
              onChange={(event) =>
                onChange(
                  event.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id),
                )
              }
            />
            <span>
              <strong>{item.name}</strong>
              <small>{item.inventoryNumber}</small>
            </span>
            <Status value={item.status} />
          </label>
        ))}
        {!items.length && <p className="muted small-text">{t('noResults')}</p>}
      </div>
    </fieldset>
  );
}
