import { z } from 'zod';
import { idSchema, imageUrlSchema, paginationSchema, slugSchema } from '../validation.js';

export const productQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(150).optional(),
  category: z.string().trim().max(180).optional(),
  minPrice: z.coerce.number().int().min(0).max(100000000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(100000000).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
  inStock: z.enum(['true', 'false']).optional(),
  featured: z.enum(['true', 'false']).optional(),
  active: z.enum(['true', 'false']).optional(),
}).refine((data) => data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice,
  { message: 'Минимальная цена выше максимальной', path: ['minPrice'] });

const variantSchema = z.object({
  id: idSchema.optional(),
  sku: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9_-]+$/),
  size: z.string().trim().min(1).max(30),
  color: z.string().trim().min(1).max(60),
  stock: z.number().int().min(0).max(100000),
}).strict();
const variantsSchema = z.array(variantSchema).min(1).max(60)
  .refine((variants) => new Set(variants.map((variant) => variant.sku)).size === variants.length, 'Артикулы должны быть уникальными')
  .refine((variants) => {
    const ids = variants.flatMap((variant) => variant.id ? [variant.id] : []);
    return new Set(ids).size === ids.length;
  }, 'Варианты не должны повторяться');
const productFields = z.object({
  name: z.string().trim().min(2).max(160),
  slug: slugSchema,
  description: z.string().trim().min(10).max(10000),
  price: z.number().int().min(1).max(100000000),
  oldPrice: z.number().int().min(1).max(100000000).nullable().optional(),
  categoryId: idSchema,
  material: z.string().trim().max(2000).nullable().optional(),
  care: z.string().trim().max(2000).nullable().optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  images: z.array(z.object({ url: imageUrlSchema, alt: z.string().trim().max(200) }).strict()).min(1).max(8),
  variants: variantsSchema,
}).strict();
export const createProductSchema = productFields.refine((data) => data.oldPrice == null || data.oldPrice >= data.price,
  { message: 'Старая цена должна быть не ниже текущей', path: ['oldPrice'] });
export const updateProductSchema = productFields.partial().refine((data) => Object.keys(data).length > 0, 'Нет полей для изменения');
export type ProductQuery = z.infer<typeof productQuerySchema>;
export type ProductCreate = z.infer<typeof createProductSchema>;
export type ProductUpdate = z.infer<typeof updateProductSchema>;
