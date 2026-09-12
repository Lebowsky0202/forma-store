import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../shared/api/client';
import { AdminEmpty, AdminError, AdminHeading, AdminLoading, FieldError } from './AdminShared';
import { imageUrlSchema, slugSchema } from './productSchema';
import type { Category } from './adminTypes';

const schema = z.object({ name: z.string().trim().min(2, 'Минимум 2 символа').max(100, 'Не более 100 символов'), slug: slugSchema, description: z.string().max(2000, 'Не более 2 000 символов'), image: z.union([z.literal(''), imageUrlSchema]) });
type Values = z.infer<typeof schema>;

function CategoryEditor({ category, onClose, onSaved }: { category?: Category; onClose: () => void; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: category?.name ?? '', slug: category?.slug ?? '', description: category?.description ?? '', image: category?.image ?? '' } });
  const mutation = useMutation({
    mutationFn: (values: Values) => api<Category>(category ? `/categories/${category.id}` : '/categories', { method: category ? 'PATCH' : 'POST', body: { ...values, description: values.description || null, image: values.image || null } }),
    onSuccess: async () => { await Promise.all(['categories', 'products', 'product', 'admin', 'cart', 'favorites'].map(key => queryClient.invalidateQueries({ queryKey: [key] }))); onSaved(category ? 'Категория обновлена.' : 'Категория добавлена.'); onClose(); },
  });
  return <section className="adm-panel adm-editor" aria-labelledby="category-editor-title"><h2 id="category-editor-title">{category ? 'Редактирование категории' : 'Новая категория'}</h2><form onSubmit={handleSubmit(values => mutation.mutate(values))} noValidate><AdminError error={mutation.error} /><div className="adm-form-grid">
    <label className="adm-field">Название<input autoFocus {...register('name')} /><FieldError message={errors.name?.message} /></label>
    <label className="adm-field">Адрес категории (slug)<input {...register('slug')} placeholder="knitwear" /><FieldError message={errors.slug?.message} /></label>
    <label className="adm-field adm-full">Описание<textarea rows={3} {...register('description')} /><FieldError message={errors.description?.message} /></label>
    <label className="adm-field adm-full">Ссылка на изображение<input {...register('image')} placeholder="https://…" /><FieldError message={errors.image?.message} /></label>
  </div><div className="adm-form-footer"><button className="adm-button" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Сохраняем…' : 'Сохранить категорию'}</button><button className="adm-button adm-secondary" type="button" disabled={mutation.isPending} onClick={onClose}>Отмена</button></div></form></section>;
}

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<Category | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const remove = useMutation({ mutationFn: (id: string) => api(`/categories/${id}`, { method: 'DELETE' }), onSuccess: async () => { setConfirmId(null); setNotice('Категория удалена.'); await queryClient.invalidateQueries({ queryKey: ['categories'] }); } });
  return <><AdminHeading title="Категории" text="Разделы каталога и их оформление."><button className="adm-button" onClick={() => { setEditor('new'); setNotice(''); }}>+ Добавить категорию</button></AdminHeading>
    {notice && <p className="adm-notice" role="status">{notice}</p>}<AdminError error={categories.error || remove.error} />
    {editor && <CategoryEditor key={editor === 'new' ? 'new' : editor.id} category={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={setNotice} />}
    {categories.isPending ? <AdminLoading /> : categories.data && (categories.data.length ? <div className="adm-table-wrap"><table className="adm-table"><caption className="adm-sr-only">Категории каталога</caption><thead><tr><th>Категория</th><th>Адрес</th><th>Товаров</th><th>Действия</th></tr></thead><tbody>{categories.data.map(category => <tr key={category.id}><td data-label="Категория"><strong>{category.name}</strong>{category.description && <span className="adm-cell-note">{category.description}</span>}</td><td data-label="Адрес">{category.slug}</td><td data-label="Товаров">{category.productCount ?? '—'}</td><td data-label="Действия"><div className="adm-row-actions"><button className="adm-text-button" onClick={() => setEditor(category)}>Изменить</button><button className="adm-text-button" onClick={() => { setConfirmId(category.id); remove.reset(); }}>Удалить</button></div>{confirmId === category.id && <div className="adm-confirm"><p>Удалить категорию «{category.name}»? Категория с товарами не удаляется.</p><button className="adm-button adm-danger" disabled={remove.isPending} onClick={() => remove.mutate(category.id)}>{remove.isPending ? 'Удаляем…' : 'Да, удалить'}</button><button className="adm-text-button" onClick={() => setConfirmId(null)}>Отмена</button></div>}</td></tr>)}</tbody></table></div> : <AdminEmpty>Категорий пока нет. Добавьте первую, чтобы создавать товары.</AdminEmpty>)}
  </>;
}
