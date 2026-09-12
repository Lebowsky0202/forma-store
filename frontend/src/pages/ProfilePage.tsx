import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut, MapPin, Plus, Trash2 } from 'lucide-react';
import { api } from '../shared/api/client';
import { useAuthStore } from '../shared/store/auth';
import { useToastStore } from '../shared/store/shop';
import type { Address, User } from '../shared/types';
import { addressSchema } from '../shared/validation';
import { Alert, Breadcrumbs, Button, ErrorState, Field, Loading } from '../shared/ui';
import AccountNav from '../components/AccountNav';
import AddressFields from '../components/AddressFields';

const profileSchema = z.object({ name: z.string().trim().min(2, 'Не менее 2 символов').max(100, 'Не более 100 символов'), phone: z.string().trim().refine(value => !value || /^\+?[\d\s()\-]{10,20}$/.test(value), 'Введите корректный телефон') });

export default function ProfilePage() {
  const user = useAuthStore(state => state.user)!;
  const setUser = useAuthStore(state => state.setUser);
  const client = useQueryClient();
  const navigate = useNavigate();
  const show = useToastStore(state => state.show);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name: user.name, phone: user.phone ?? '' } });
  const save = useMutation({ mutationFn: (body: z.infer<typeof profileSchema>) => api<User>('/users/me', { method: 'PATCH', body }), onSuccess: updated => { setUser(updated); show('Данные сохранены'); } });
  async function logout() {
    setLogoutBusy(true); setLogoutError('');
    try { await api('/auth/logout', { method: 'POST' }); useAuthStore.getState().clear(); client.clear(); navigate('/'); }
    catch (error) { setLogoutError((error as Error).message); }
    finally { setLogoutBusy(false); }
  }
  return <div className="container page-space"><Breadcrumbs items={[{ label: 'Личный кабинет' }]} /><div className="page-title-row"><h1>Привет, {user.name.split(' ')[0]}<span className="heading-dot">.</span></h1><button className="text-link" disabled={logoutBusy} onClick={logout}><LogOut size={17} />{logoutBusy ? 'Выходим…' : 'Выйти'}</button></div>{logoutError && <Alert>{logoutError}</Alert>}<AccountNav /><div className="profile-layout"><form className="profile-form soft-panel" noValidate onSubmit={handleSubmit(data => save.mutate(data))}><h2>Личные данные</h2><Field label="Имя" error={errors.name?.message}><input autoComplete="name" {...register('name')} /></Field><Field label="Email"><input type="email" value={user.email} readOnly /><span className="field-hint">Email используется для входа.</span></Field><Field label="Телефон" error={errors.phone?.message}><input type="tel" autoComplete="tel" placeholder="+7 777 123 45 67" {...register('phone')} /></Field>{save.error && <Alert>{save.error.message}</Alert>}{save.isSuccess && <Alert success>Ваши данные обновлены.</Alert>}<Button disabled={save.isPending}>{save.isPending ? 'Сохраняем…' : 'Сохранить изменения'}</Button></form><Addresses /></div></div>;
}

function Addresses() {
  const user = useAuthStore(state => state.user)!;
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const addresses = useQuery({ queryKey: ['addresses', user.id], queryFn: () => api<Address[]>('/users/me/addresses') });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Address>({ resolver: zodResolver(addressSchema), defaultValues: { name: user.name, phone: user.phone ?? '' } });
  const save = useMutation({ mutationFn: (body: Address) => api<Address>('/users/me/addresses', { method: 'POST', body }), onSuccess: () => { client.invalidateQueries({ queryKey: ['addresses'] }); setAdding(false); reset(); } });
  const remove = useMutation({ mutationFn: (id: string) => api(`/users/me/addresses/${id}`, { method: 'DELETE' }), onSuccess: () => client.invalidateQueries({ queryKey: ['addresses'] }) });
  return <section className="address-book"><div className="section-heading"><h2>Адреса доставки</h2>{!adding && <button className="text-link" onClick={() => { save.reset(); setAdding(true); }}><Plus size={17} />Добавить</button>}</div>{addresses.isLoading ? <Loading /> : addresses.error ? <ErrorState error={addresses.error} retry={() => addresses.refetch()} /> : addresses.data?.length ? <div className="saved-addresses">{addresses.data.map(address => <article className="saved-address" key={address.id}><MapPin size={20} /><div><h3>{address.city}, {address.street}</h3><p>{address.name}<br />{address.phone}{address.postalCode && <><br />{address.postalCode}</>}</p></div><button className="icon-button" disabled={remove.isPending} onClick={() => address.id && remove.mutate(address.id)} aria-label={`Удалить адрес: ${address.street}`}><Trash2 size={18} /></button></article>)}</div> : <p className="soft-panel muted">Сохраните адрес, чтобы быстрее оформлять покупки.</p>}{remove.error && <Alert>{remove.error.message}</Alert>}{remove.isSuccess && <Alert success>Адрес удалён.</Alert>}{adding && <form className="address-form" noValidate onSubmit={handleSubmit(data => save.mutate(data))}><h3>Новый адрес</h3><AddressFields register={register} errors={errors} />{save.error && <Alert>{save.error.message}</Alert>}<div className="form-actions"><Button disabled={save.isPending}>{save.isPending ? 'Сохраняем…' : 'Сохранить адрес'}</Button><Button type="button" className="secondary" disabled={save.isPending} onClick={() => setAdding(false)}>Отмена</Button></div></form>}</section>;
}
