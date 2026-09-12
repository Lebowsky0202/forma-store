import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { AdminEmpty, AdminError, AdminHeading, AdminLoading, AdminPagination } from './AdminShared';
import { formatMoney, type Category, type Paginated, type Product } from './adminTypes';
import ProductEditor from './ProductEditor';

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('');
  const [editor, setEditor] = useState<Product | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 350); return () => clearTimeout(timer); }, [search]);
  const params = new URLSearchParams({ page: String(page), limit: '12', search: query });
  if (active) params.set('active', active);
  const products = useQuery({ queryKey: ['admin', 'products', page, query, active], queryFn: () => api<Paginated<Product>>(`/admin/products?${params}`) });
  useEffect(() => { if (products.data && page > Math.max(1, products.data.pages)) setPage(Math.max(1, products.data.pages)); }, [products.data, page]);
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: async (_result, id) => { setConfirmId(null); setEditor(current => current !== 'new' && current?.id === id ? null : current); setNotice('Товар скрыт из магазина.'); await Promise.all(['admin', 'products', 'product', 'categories', 'cart', 'favorites'].map(key => queryClient.invalidateQueries({ queryKey: [key] }))); },
  });
  return <><AdminHeading title="Товары" text="Ассортимент, цены и доступные размеры."><button className="adm-button" onClick={() => { setEditor('new'); setNotice(''); }}>+ Добавить товар</button></AdminHeading>
    {notice && <p className="adm-notice" role="status">{notice}</p>}
    <AdminError error={products.error || categories.error || remove.error} />
    {editor && categories.isPending && <AdminLoading />}
    {editor && categories.data && (categories.data.length ? <ProductEditor key={editor === 'new' ? 'new' : editor.id} product={editor === 'new' ? undefined : editor} categories={categories.data} onClose={() => setEditor(null)} onSaved={setNotice} /> : <AdminEmpty>Сначала <Link to="/admin/categories">добавьте категорию</Link>, чтобы создать товар.</AdminEmpty>)}
    <div className="adm-toolbar"><label className="adm-field adm-search">Найти товар<input type="search" maxLength={150} value={search} onChange={event => setSearch(event.target.value)} placeholder="Название товара" /></label><label className="adm-field">Видимость<select value={active} onChange={event => { setActive(event.target.value); setPage(1); setConfirmId(null); }}><option value="">Все товары</option><option value="true">В продаже</option><option value="false">Скрытые</option></select></label></div>
    {products.isPending ? <AdminLoading /> : products.data && (products.data.items.length ? <><div className="adm-table-wrap"><table className="adm-table"><caption className="adm-sr-only">Товары магазина</caption><thead><tr><th>Товар</th><th>Цена</th><th>Остаток</th><th>Видимость</th><th>Действия</th></tr></thead><tbody>{products.data.items.map(product => <tr key={product.id}>
      <td data-label="Товар"><div className="adm-product-cell">{product.images[0] && <img src={product.images[0].url} alt="" loading="lazy" />}<div><strong>{product.name}</strong><span>{product.category.name}</span></div></div></td><td data-label="Цена" className="adm-nowrap">{formatMoney(product.price)}</td><td data-label="Остаток">{product.variants.reduce((sum, variant) => sum + variant.stock, 0)} шт.</td><td data-label="Видимость"><span className={`adm-badge ${product.active ? 'adm-positive' : ''}`}>{product.active ? 'В продаже' : 'Скрыт'}</span></td>
      <td data-label="Действия"><div className="adm-row-actions"><button className="adm-text-button" onClick={() => { setEditor(product); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Изменить</button>{product.active && <button className="adm-text-button" disabled={remove.isPending} onClick={() => { setConfirmId(product.id); remove.reset(); }}>Скрыть</button>}</div>
        {confirmId === product.id && <div className="adm-confirm"><p>Скрыть товар из каталога? Чтобы вернуть его, включите «Показывать в магазине» в редакторе.</p><button className="adm-button adm-danger" disabled={remove.isPending} onClick={() => remove.mutate(product.id)}>{remove.isPending ? 'Скрываем…' : 'Да, скрыть'}</button><button className="adm-text-button" disabled={remove.isPending} onClick={() => setConfirmId(null)}>Отмена</button></div>}</td>
    </tr>)}</tbody></table></div><AdminPagination page={page} pages={products.data.pages} total={products.data.total} onChange={setPage} /></> : <AdminEmpty>Товары не найдены. Измените поиск или добавьте новый товар.</AdminEmpty>)}
  </>;
}
