import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { useAuthStore } from '../../shared/store/auth';
import { AdminEmpty, AdminError, AdminHeading, AdminLoading, AdminPagination } from './AdminShared';
import { formatDate, type AdminUser, type Paginated } from './adminTypes';

function UserRow({ user, isSelf, onSaved }: { user: AdminUser; isSelf: boolean; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const update = useMutation({ mutationFn: () => api(`/admin/users/${user.id}`, { method: 'PATCH', body: { ...(role !== user.role ? { role } : {}), ...(active !== user.active ? { active } : {}) } }), onSuccess: async () => { setEditing(false); await queryClient.invalidateQueries({ queryKey: ['admin'] }); onSaved(`Доступ пользователя ${user.name} обновлён.`); } });
  const cancel = () => { setEditing(false); setRole(user.role); setActive(user.active); update.reset(); };
  return <tr><td data-label="Пользователь"><strong>{user.name}</strong><span className="adm-cell-note">{user.email}</span>{user.phone && <span className="adm-cell-note">{user.phone}</span>}</td><td data-label="Регистрация">{formatDate(user.createdAt)}</td><td data-label="Роль">{editing ? <label className="adm-field"><span className="adm-sr-only">Роль пользователя {user.email}</span><select value={role} disabled={update.isPending} onChange={event => setRole(event.target.value as AdminUser['role'])}><option value="USER">Покупатель</option><option value="ADMIN">Администратор</option></select></label> : user.role === 'ADMIN' ? 'Администратор' : 'Покупатель'}</td><td data-label="Доступ">{editing ? <label className="adm-check"><input type="checkbox" checked={active} disabled={update.isPending} onChange={event => setActive(event.target.checked)} /> Активен</label> : <span className={`adm-badge ${user.active ? 'adm-positive' : ''}`}>{user.active ? 'Активен' : 'Заблокирован'}</span>}</td><td data-label="Действия">{editing ? <div className="adm-user-actions"><button className="adm-button" disabled={update.isPending || (role === user.role && active === user.active)} onClick={() => update.mutate()}>{update.isPending ? 'Сохраняем…' : 'Сохранить'}</button><button className="adm-text-button" disabled={update.isPending} onClick={cancel}>Отмена</button><AdminError error={update.error} />{role === 'ADMIN' && role !== user.role && <p className="adm-hint">Пользователь получит полный доступ к управлению магазином.</p>}{!active && user.active && <p className="adm-hint">Пользователь потеряет доступ к личному кабинету.</p>}</div> : isSelf ? <span className="adm-cell-note">Ваш аккаунт. Собственный доступ администратора защищён.</span> : <button className="adm-text-button" onClick={() => setEditing(true)}>Изменить доступ</button>}</td></tr>;
}

export default function AdminUsers() {
  const currentUserId = useAuthStore(state => state.user?.id);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 350); return () => clearTimeout(timer); }, [search]);
  const params = new URLSearchParams({ page: String(page), limit: '12', search: query });
  const users = useQuery({ queryKey: ['admin', 'users', page, query], queryFn: () => api<Paginated<AdminUser>>(`/admin/users?${params}`) });
  useEffect(() => { if (users.data && page > Math.max(1, users.data.pages)) setPage(Math.max(1, users.data.pages)); }, [users.data, page]);
  return <><AdminHeading title="Покупатели" text="Учётные записи и права доступа к магазину." />
    {notice && <p className="adm-notice" role="status">{notice}</p>}<AdminError error={users.error} />
    <div className="adm-toolbar"><label className="adm-field adm-search">Найти пользователя<input type="search" maxLength={150} value={search} onChange={event => setSearch(event.target.value)} placeholder="Имя или электронная почта" /></label></div>
    {users.isPending ? <AdminLoading /> : users.data && (users.data.items.length ? <><div className="adm-table-wrap"><table className="adm-table"><caption className="adm-sr-only">Учётные записи</caption><thead><tr><th>Пользователь</th><th>Регистрация</th><th>Роль</th><th>Доступ</th><th>Действия</th></tr></thead><tbody>{users.data.items.map(user => <UserRow key={`${user.id}-${user.role}-${user.active}`} user={user} isSelf={user.id === currentUserId} onSaved={setNotice} />)}</tbody></table></div><AdminPagination page={page} pages={users.data.pages} total={users.data.total} onChange={setPage} /></> : <AdminEmpty>Пользователи не найдены. Попробуйте другой запрос.</AdminEmpty>)}
  </>;
}
