import { compareSizes } from '../shared/sizes';
import { useState, type FormEvent } from 'react';
import { Heart, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../shared/types';
import { useCart, useFavorites } from '../shared/api/queries';
import { useToastStore } from '../shared/store/shop';
import { Price } from '../shared/ui';

const colors: Record<string, string> = {
  'Чёрный': '#272727', 'Белый': '#f7f7f2', 'Молочный': '#e8e4d9', 'Бежевый': '#bcab91',
  'Серый': '#9a9b95', 'Серый меланж': '#9a9b95', 'Хаки': '#757c5a', 'Синий': '#506883',
  'Голубой': '#aac5db', 'Коричневый': '#735443', 'Зелёный': '#617b5e', 'Пудровый': '#d5aaa1',
  'Терракотовый': '#a35f42', 'Карамельный': '#ad8152', 'Тёмно-синий': '#263346', 'Золотистый': '#b39458',
};
export function ColorSwatch({ color }: { color: string }) {
  return <span className="color-swatch" title={color} style={{ background: colors[color] ?? '#c7b5a2' }} />;
}

export function ProductCard({ product }: { product: Product }) {
  const { favorites, toggle } = useFavorites();
  const cart = useCart();
  const show = useToastStore(state => state.show);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [variantId, setVariantId] = useState('');
  const [error, setError] = useState('');
  const favorite = favorites.some(item => item.id === product.id);
  const discount = product.oldPrice && product.oldPrice > product.price ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const variants = [...product.variants].sort((left, right) => compareSizes(left.size, right.size));
  const available = variants.some(variant => variant.stock > 0);

  async function onFavorite() {
    setFavoriteBusy(true);
    try { await toggle(product); show(favorite ? 'Удалено из избранного' : 'Добавлено в избранное'); }
    catch (failure) { setError((failure as Error).message); }
    finally { setFavoriteBusy(false); }
  }
  async function quickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const details = event.currentTarget.closest('details');
    const variant = product.variants.find(item => item.id === variantId);
    if (!variant) { setError('Выберите размер и цвет'); return; }
    setAdding(true); setError('');
    try {
      await cart.add(product, variant);
      show('Товар добавлен в корзину');
      if (details) details.open = false;
    } catch (failure) { setError((failure as Error).message); }
    finally { setAdding(false); }
  }
  return <article className="product-card">
    <div className="product-photo">
      <Link to={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true"><img src={product.images[0]?.url} alt={product.images[0]?.alt || product.name} loading="lazy" /></Link>
      <div className="product-badges">{discount > 0 ? <span className="badge sale">−{discount}%</span> : product.featured ? <span className="badge">ВЫБОР FORMA</span> : null}{!available && <span className="badge">НЕТ В НАЛИЧИИ</span>}</div>
      <button className={`favorite-button ${favorite ? 'selected' : ''}`} aria-label={`${favorite ? 'Удалить из избранного' : 'В избранное'}: ${product.name}`} aria-pressed={favorite} disabled={favoriteBusy} onClick={onFavorite}><Heart size={20} fill={favorite ? 'currentColor' : 'none'} /></button>
      <Link className="quick-view" to={`/product/${product.slug}`}>Подробнее<ArrowUpRight size={18} /></Link>
    </div>
    <div className="product-meta"><span className="product-category">{product.category.name}</span><Link className="product-title" to={`/product/${product.slug}`}>{product.name}</Link><Price value={product.price} oldPrice={product.oldPrice} />
      <div className="product-colors">{[...new Set(product.variants.map(variant => variant.color))].slice(0, 4).map(color => <ColorSwatch key={color} color={color} />)}<span>{[...new Set(variants.filter(variant => variant.stock > 0).map(variant => variant.size))].join(' · ')}</span></div>
      {available && <details className="card-quick-add"><summary>В корзину<ShoppingBag size={16} /></summary><form onSubmit={quickAdd}><label className="field"><span>Размер и цвет</span><select aria-label={`Размер и цвет: ${product.name}`} value={variantId} onChange={event => setVariantId(event.target.value)}><option value="">Выберите вариант</option>{variants.map(variant => <option key={variant.id} value={variant.id} disabled={!variant.stock}>{variant.size} · {variant.color}{!variant.stock ? ' — нет в наличии' : ''}</option>)}</select></label><button className="button" disabled={adding || !variantId}>{adding ? 'Добавляем…' : 'Добавить'}</button></form></details>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  </article>;
}
export function ProductGrid({ products }: { products: Product[] }) { return <div className="product-grid">{products.map(product => <ProductCard product={product} key={product.id} />)}</div>; }
export function ProductSkeleton({ count = 4 }: { count?: number }) { return <div className="product-grid" aria-label="Загрузка товаров" role="status">{Array.from({ length: count }, (_, index) => <div key={index} className="product-skeleton"><div className="skeleton skeleton-image" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div>)}</div>; }
