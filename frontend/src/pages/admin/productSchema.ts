import { z } from 'zod';
import type { Product } from './adminTypes';

export const imageUrlSchema = z.string().trim().min(1, 'Добавьте изображение').max(2000, 'Ссылка слишком длинная').refine(value => {
  if (/^\/uploads\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}, 'Используйте корректную HTTPS-ссылку или загрузите файл');
export const slugSchema = z.string().trim().min(2, 'Минимум 2 символа').max(180, 'Не более 180 символов').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Латинские строчные буквы, цифры и дефисы');
const priceSchema = z.number({ invalid_type_error: 'Укажите цену числом' }).int('Цена должна быть целым числом').min(1, 'Цена от 1 ₸').max(100000000, 'Цена не более 100 000 000 ₸');
const optionalPrice = z.union([z.literal(''), priceSchema]);

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Минимум 2 символа').max(160, 'Не более 160 символов'),
  slug: slugSchema,
  description: z.string().trim().min(10, 'Минимум 10 символов').max(10000, 'Не более 10 000 символов'),
  price: priceSchema,
  oldPrice: optionalPrice,
  categoryId: z.string().min(1, 'Выберите категорию'),
  material: z.string().max(2000, 'Не более 2 000 символов'),
  care: z.string().max(2000, 'Не более 2 000 символов'),
  active: z.boolean(),
  featured: z.boolean(),
  images: z.array(z.object({ url: imageUrlSchema, alt: z.string().max(200, 'Не более 200 символов') })).min(1, 'Добавьте хотя бы одно изображение').max(8, 'Не более 8 изображений'),
  variants: z.array(z.object({
    id: z.string().optional(),
    sku: z.string().trim().min(3, 'Минимум 3 символа').max(80, 'Не более 80 символов').regex(/^[A-Za-z0-9_-]+$/, 'Буквы, цифры, дефис или подчёркивание'),
    size: z.string().trim().min(1, 'Укажите размер').max(30, 'Не более 30 символов'),
    color: z.string().trim().min(1, 'Укажите цвет').max(60, 'Не более 60 символов'),
    stock: z.number({ invalid_type_error: 'Укажите остаток числом' }).int('Целое число').min(0, 'Не меньше 0').max(100000, 'Не более 100 000 единиц'),
  })).min(1, 'Добавьте вариант товара').max(60, 'Не более 60 вариантов'),
}).superRefine((value, context) => {
  if (value.oldPrice !== '' && value.oldPrice < value.price) context.addIssue({ code: 'custom', path: ['oldPrice'], message: 'Старая цена должна быть не меньше текущей' });
  const skus = new Set<string>();
  value.variants.forEach((variant, index) => {
    if (skus.has(variant.sku)) context.addIssue({ code: 'custom', path: ['variants', index, 'sku'], message: 'Артикул должен быть уникальным' });
    skus.add(variant.sku);
  });
});

export type ProductValues = z.infer<typeof productSchema>;

export function productDefaults(product?: Product): ProductValues {
  return {
    name: product?.name ?? '', slug: product?.slug ?? '', description: product?.description ?? '',
    categoryId: product?.categoryId ?? '', price: product?.price ?? 0, oldPrice: product?.oldPrice ?? '',
    material: product?.material ?? '', care: product?.care ?? '', active: product?.active ?? true,
    featured: product?.featured ?? false,
    images: product?.images.map(image => ({ url: image.url, alt: image.alt })) ?? [],
    variants: product?.variants.map(variant => ({ ...variant })) ?? [{ sku: '', size: 'M', color: '', stock: 0 }],
  };
}
