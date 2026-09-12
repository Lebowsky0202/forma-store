import { useState, type ChangeEvent } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api/client';
import { AdminError, FieldError } from './AdminShared';
import { productDefaults, productSchema, type ProductValues } from './productSchema';
import type { Category, Product } from './adminTypes';

interface Props { product?: Product; categories: Category[]; onClose: () => void; onSaved: (message: string) => void }

export default function ProductEditor({ product, categories, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [uploading, setUploading] = useState(false);
  const form = useForm<ProductValues>({ resolver: zodResolver(productSchema), defaultValues: productDefaults(product) });
  const { register, control, handleSubmit, formState: { errors, dirtyFields, isDirty }, watch } = form;
  const images = useFieldArray({ control, name: 'images' });
  const variants = useFieldArray({ control, name: 'variants', keyName: 'fieldId' });
  const imageValues = watch('images');
  const save = useMutation({
    mutationFn: (values: ProductValues) => {
      const normalized = { ...values, oldPrice: values.oldPrice === '' ? null : values.oldPrice, material: values.material || null, care: values.care || null };
      // Editing copy or visibility must not rewrite inventory from an older form snapshot.
      const body = product ? Object.fromEntries(Object.entries(normalized).filter(([key]) => key in dirtyFields)) : normalized;
      return api<Product>(product ? `/products/${product.id}` : '/products', { method: product ? 'PATCH' : 'POST', body });
    },
    onSuccess: async () => {
      await Promise.all(['admin', 'products', 'product', 'categories', 'cart', 'favorites'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      onSaved(product ? 'Товар обновлён.' : 'Товар добавлен в каталог.');
      onClose();
    },
  });

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError(new Error('Выберите JPEG, PNG или WebP размером до 5 МБ.'));
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const result = await api<{ url: string }>('/uploads', { method: 'POST', body });
      images.append({ url: result.url, alt: form.getValues('name') || file.name });
    } catch (error) { setUploadError(error instanceof Error ? error : new Error('Не удалось загрузить изображение.')); }
    finally { setUploading(false); }
  }

  return <section className="adm-panel adm-editor" aria-labelledby="product-editor-title">
    <div className="adm-editor-title"><h2 id="product-editor-title">{product ? 'Редактирование товара' : 'Новый товар'}</h2><button className="adm-button adm-secondary" type="button" disabled={save.isPending || uploading} onClick={onClose}>Закрыть</button></div>
    <form onSubmit={handleSubmit(values => save.mutate(values))} noValidate>
      <AdminError error={save.error} />
      <div className="adm-form-grid">
        <label className="adm-field">Название<input {...register('name')} autoFocus /><FieldError message={errors.name?.message} /></label>
        <label className="adm-field">Адрес товара (slug)<input {...register('slug')} placeholder="cotton-shirt" /><FieldError message={errors.slug?.message} /></label>
        <label className="adm-field">Категория<select {...register('categoryId')}><option value="">Выберите категорию</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><FieldError message={errors.categoryId?.message} /></label>
        <div className="adm-form-grid"><label className="adm-field">Цена, ₸<input type="number" min="1" max="100000000" step="1" {...register('price', { valueAsNumber: true })} /><FieldError message={errors.price?.message} /></label>
          <label className="adm-field">Старая цена, ₸<input type="number" min="1" max="100000000" step="1" {...register('oldPrice', { setValueAs: value => value === '' ? '' : Number(value) })} /><FieldError message={errors.oldPrice?.message} /></label></div>
        <label className="adm-field adm-full">Описание<textarea rows={4} {...register('description')} /><FieldError message={errors.description?.message} /></label>
        <label className="adm-field">Состав<textarea rows={2} {...register('material')} /><FieldError message={errors.material?.message} /></label>
        <label className="adm-field">Уход<textarea rows={2} {...register('care')} /><FieldError message={errors.care?.message} /></label>
      </div>
      <div className="adm-checkboxes"><label><input type="checkbox" {...register('active')} /> Показывать в магазине</label><label><input type="checkbox" {...register('featured')} /> Рекомендовать на главной</label></div>
      <fieldset><legend>Изображения</legend><p className="adm-hint">Первое изображение — обложка товара. До 8 файлов, JPEG / PNG / WebP, до 5 МБ каждый.</p>
        <AdminError error={uploadError} /><FieldError message={errors.images?.message ?? errors.images?.root?.message} />
        <div className="adm-image-list">{images.fields.map((field, index) => <div key={field.id} className="adm-image-edit">
          {imageValues[index]?.url && <img src={imageValues[index].url} alt={imageValues[index]?.alt || 'Изображение товара'} />}
          <label className="adm-field">Ссылка {index + 1}<input {...register(`images.${index}.url`)} placeholder="https://…" /><FieldError message={errors.images?.[index]?.url?.message} /></label>
          <label className="adm-field">Описание изображения<input {...register(`images.${index}.alt`)} /><FieldError message={errors.images?.[index]?.alt?.message} /></label>
          <button className="adm-text-button" type="button" disabled={save.isPending || uploading} onClick={() => images.remove(index)}>Удалить фото {index + 1}</button>
        </div>)}</div>
        <div className="adm-inline-actions"><label className="adm-upload">{uploading ? 'Загрузка…' : 'Загрузить файл'}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Загрузить изображение товара" disabled={uploading || images.fields.length >= 8 || save.isPending} onChange={upload} /></label>
          <button className="adm-button adm-secondary" type="button" disabled={images.fields.length >= 8 || uploading || save.isPending} onClick={() => images.append({ url: '', alt: '' })}>Добавить по ссылке</button></div>
      </fieldset>
      <fieldset><legend>Размеры, цвета и остатки</legend><p className="adm-hint">У каждого варианта должен быть отдельный артикул. Остаток — доступное к продаже количество.</p><FieldError message={errors.variants?.message ?? errors.variants?.root?.message} />
        <div className="adm-variant-list">{variants.fields.map((field, index) => <div className="adm-variant-edit" key={field.fieldId}>
          {field.id && <input type="hidden" {...register(`variants.${index}.id`)} />}
          <label className="adm-field">Артикул {index + 1}<input {...register(`variants.${index}.sku`)} placeholder="SHIRT-BLK-M" /><FieldError message={errors.variants?.[index]?.sku?.message} /></label>
          <label className="adm-field">Размер<input {...register(`variants.${index}.size`)} /><FieldError message={errors.variants?.[index]?.size?.message} /></label>
          <label className="adm-field">Цвет<input {...register(`variants.${index}.color`)} /><FieldError message={errors.variants?.[index]?.color?.message} /></label>
          <label className="adm-field">Остаток<input type="number" min="0" max="100000" step="1" {...register(`variants.${index}.stock`, { valueAsNumber: true })} /><FieldError message={errors.variants?.[index]?.stock?.message} /></label>
          <button className="adm-text-button" type="button" disabled={variants.fields.length <= 1 || save.isPending} aria-label={`Удалить вариант ${index + 1}`} onClick={() => variants.remove(index)}>Удалить</button>
        </div>)}</div><button className="adm-button adm-secondary" type="button" disabled={variants.fields.length >= 60 || save.isPending} onClick={() => variants.append({ sku: '', size: '', color: '', stock: 0 })}>+ Добавить вариант</button>
      </fieldset>
      <div className="adm-form-footer"><button className="adm-button" type="submit" disabled={save.isPending || uploading || (!!product && !isDirty)}>{save.isPending ? 'Сохраняем…' : 'Сохранить товар'}</button><button type="button" className="adm-button adm-secondary" disabled={save.isPending || uploading} onClick={onClose}>Отмена</button></div>
    </form>
  </section>;
}
