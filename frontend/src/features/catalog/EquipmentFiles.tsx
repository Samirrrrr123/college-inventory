import { useState } from 'react';
import { api } from '../../api/client';
import { queryString } from '../../api/catalog';
import { errorMessage } from '../../api/errorMessage';
import { usePreferences } from '../../app/Preferences';
import { Button } from '../../components/Button';
import { Input } from '../../components/Fields';
import { Pagination } from '../../components/Common';
import { ApiFeedback } from './ApiFeedback';
import { useApiList } from './useApiList';
import { useDebouncedValue } from './useDebouncedValue';

interface Attachment {
  id: string;
  name: string;
  size: number;
  createdAt: string;
}

export function EquipmentFiles({
  equipmentId,
  canManage,
}: {
  equipmentId: string;
  canManage: boolean;
}) {
  const { t, date } = usePreferences();
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search);
  const root = `/equipment/${equipmentId}/files`;
  const list = useApiList<Attachment>(
    `${root}?${queryString({ search: term, page, pageSize: 5 })}`,
    revision,
  );
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const [deleting, setDeleting] = useState<Attachment | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);

  async function upload() {
    if (!file) return setFailure(t('chooseFile'));
    if (
      !['image/png', 'image/jpeg', 'application/pdf'].includes(file.type) ||
      !/\.(png|jpe?g|pdf)$/iu.test(file.name)
    )
      return setFailure(t('fileTypeError'));
    if (file.size > 5 * 1024 * 1024) return setFailure(t('fileSizeError'));
    if (!file.size) return setFailure(t('emptyFile'));
    setPending(true);
    setFailure('');
    try {
      await api(root, 'POST', file);
      setFile(null);
      setInputKey((value) => value + 1);
      setPage(1);
      setSearch('');
      setRevision((value) => value + 1);
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  async function download(item: Attachment) {
    setPending(true);
    setFailure('');
    try {
      const blob = await api<Blob>(`${root}/${item.id}`, 'GET', undefined, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setPending(true);
    setFailure('');
    try {
      await api(`${root}/${deleting.id}`, 'DELETE');
      setDeleting(null);
      setPage(1);
      setRevision((value) => value + 1);
    } catch (error) {
      setFailure(errorMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="catalog-description equipment-files" aria-label={t('files')}>
      <h3>{t('files')}</h3>
      {canManage && (
        <fieldset disabled={pending}>
          <label className="field">
            <span>{t('upload')}</span>
            <input
              key={inputKey}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="muted small-text">{t('uploadHint')}</p>
          <Button variant="secondary" onClick={() => void upload()}>
            {t(pending ? 'pleaseWait' : 'uploadFile')}
          </Button>
        </fieldset>
      )}
      <Input
        label={t('fileSearch')}
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
        onRetry={() => setRevision((value) => value + 1)}
      />
      {failure && (
        <p className="field-error" role="alert">
          {failure}
        </p>
      )}
      {!list.loading && !list.error && list.result && (
        <>
          {!list.result.data.length && <p className="muted">{t('noFiles')}</p>}
          <ul className="file-list">
            {list.result.data.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {Math.max(1, Math.ceil(item.size / 1024))} KB · {date(item.createdAt)}
                  </small>
                </div>
                <div className="file-actions">
                  <Button variant="text" disabled={pending} onClick={() => void download(item)}>
                    {t('downloadFile')}
                  </Button>
                  {canManage && (
                    <Button
                      variant="text"
                      disabled={pending}
                      aria-label={`${t('delete')}: ${item.name}`}
                      onClick={() => setDeleting(item)}
                    >
                      {t('delete')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={5} total={list.result.total} onChange={setPage} />
        </>
      )}
      {deleting && (
        <div className="file-confirmation" role="group" aria-label={t('deleteTitle')}>
          <p>
            {t('deleteTitle')}: {deleting.name}?
          </p>
          <Button variant="danger" disabled={pending} onClick={() => void remove()}>
            {t('confirmDeleteFile')}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => setDeleting(null)}>
            {t('cancel')}
          </Button>
        </div>
      )}
    </section>
  );
}
