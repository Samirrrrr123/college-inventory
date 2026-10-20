import { useState } from 'react';
import { usePreferences } from '../app/Preferences';
import { useDemo } from '../demo/DemoProvider';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Fields';
import { EmptyState, Notice, PageHeader, Tabs } from '../components/Common';
import type { Role } from '../domain/types';
import type { Category, Person } from '../domain/types';
import { PersonForm } from '../features/people/PersonForm';
import { DirectoryForm } from '../features/directories/DirectoryForm';
import { DeleteDialog } from '../components/DeleteDialog';

export function AdministrationPage() {
  const { t, language, date } = usePreferences();
  const { person, people, categories, equipment, audit, deleteCategory } = useDemo();
  const [tab, setTab] = useState<'users' | 'categories' | 'audit'>('users');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [notice, setNotice] = useState('');
  const [personForm, setPersonForm] = useState<{ item?: Person } | null>(null);
  const [categoryForm, setCategoryForm] = useState<{ item?: Category } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const roleLabel = (value: Role) =>
    t(value === 'ADMIN' ? 'admin' : value === 'LAB_ASSISTANT' ? 'assistant' : 'teacher');

  if (person.role !== 'ADMIN')
    return (
      <section className="panel empty-state">
        <h1>{t('accessDenied')}</h1>
        <p>{t('accessDeniedNote')}</p>
      </section>
    );
  const filtered = people.filter(
    (item) =>
      `${item.name} ${item.email}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase().trim()) &&
      (!role || item.role === role),
  );

  return (
    <>
      <PageHeader title={t('administration')} subtitle={t('adminSubtitle')}>
        {tab === 'users' && <Button onClick={() => setPersonForm({})}>+ {t('addUser')}</Button>}
        {tab === 'categories' && (
          <Button onClick={() => setCategoryForm({})}>+ {t('addCategory')}</Button>
        )}
      </PageHeader>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'users', label: t('users') },
          { value: 'categories', label: t('categories') },
          { value: 'audit', label: t('audit') },
        ]}
      />
      {tab === 'users' && (
        <>
          <div className="filters filters--two">
            <Input
              label={t('search')}
              placeholder={t('personSearch')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              label={t('role')}
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="">{t('allRoles')}</option>
              <option value="ADMIN">{t('admin')}</option>
              <option value="LAB_ASSISTANT">{t('assistant')}</option>
              <option value="TEACHER">{t('teacher')}</option>
            </Select>
          </div>
          <section className="panel">
            {filtered.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('user')}</th>
                      <th>Email</th>
                      <th>{t('role')}</th>
                      <th>{t('status')}</th>
                      <th>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td data-label={t('user')}>
                          <strong>{item.name}</strong>
                        </td>
                        <td data-label="Email">{item.email}</td>
                        <td data-label={t('role')}>{roleLabel(item.role)}</td>
                        <td data-label={t('status')}>
                          <span
                            className={`badge ${item.blocked ? 'badge--written_off' : 'badge--available'}`}
                          >
                            {t(item.blocked ? 'blocked' : 'active')}
                          </span>
                        </td>
                        <td data-label={t('actions')}>
                          <Button
                            variant="text"
                            aria-label={`${t('edit')}: ${item.name}`}
                            onClick={() => setPersonForm({ item })}
                          >
                            {t('edit')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState filtered />
            )}
          </section>
          <p className="muted small-text">{t('adminNote')}</p>
        </>
      )}
      {tab === 'categories' && (
        <section className="panel">
          <h2>{t('categories')}</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('category')}</th>
                  <th>{t('totalEquipment')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((item) => (
                  <tr key={item.id}>
                    <td data-label={t('category')}>{item.title[language]}</td>
                    <td data-label={t('totalEquipment')}>
                      {equipment.filter((eq) => eq.categoryId === item.id).length}
                    </td>
                    <td data-label={t('actions')}>
                      <div className="row-actions">
                        <Button
                          variant="text"
                          aria-label={`${t('edit')}: ${item.title[language]}`}
                          onClick={() => setCategoryForm({ item })}
                        >
                          {t('edit')}
                        </Button>
                        <Button
                          variant="text"
                          aria-label={`${t('delete')}: ${item.title[language]}`}
                          onClick={() => setDeleting(item)}
                        >
                          {t('delete')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === 'audit' && (
        <section className="panel">
          <h2>{t('audit')}</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('actor')}</th>
                  <th>{t('action')}</th>
                  <th>{t('object')}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((item) => (
                  <tr key={item.id}>
                    <td data-label={t('date')}>{date(item.createdAt)}</td>
                    <td data-label={t('actor')}>{item.actor}</td>
                    <td data-label={t('action')}>{t(item.action)}</td>
                    <td data-label={t('object')}>{item.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {personForm && (
        <PersonForm
          item={personForm.item}
          onClose={() => setPersonForm(null)}
          onSaved={() => {
            setPersonForm(null);
            setNotice(t('personSaved'));
          }}
        />
      )}
      {categoryForm && (
        <DirectoryForm
          kind="category"
          item={categoryForm.item}
          onClose={() => setCategoryForm(null)}
          onSaved={() => {
            setCategoryForm(null);
            setNotice(t('categorySaved'));
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          title={t('deleteCategory')}
          name={deleting.title[language]}
          onDelete={() => deleteCategory(deleting.id)}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setNotice(t('directoryDeleted'));
          }}
        />
      )}
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
    </>
  );
}
