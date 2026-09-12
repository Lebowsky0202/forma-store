import { z } from 'zod';

export const idSchema = z.string().trim().min(1).max(180);
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
export const phoneSchema = z.string().trim().regex(/^\+?[\d\s()-]{7,24}$/, 'Укажите корректный телефон');
export const addressSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  city: z.string().trim().min(2).max(100),
  street: z.string().trim().min(5).max(250),
  postalCode: z.string().trim().max(20).optional(),
}).strict();
export const slugSchema = z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const imageUrlSchema = z.string().max(2000).refine((url) => {
  if (/^\/uploads\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$/.test(url)) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch { return false; }
}, 'Требуется HTTPS URL или путь к загруженному изображению');

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}
