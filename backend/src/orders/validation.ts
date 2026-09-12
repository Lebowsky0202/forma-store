import { z } from 'zod';
import { addressSchema, idSchema, paginationSchema } from '../validation.js';

export const createOrderSchema = z.object({
  address: addressSchema, shippingMethodId: idSchema, paymentMethod: z.literal('COD'),
}).strict();
export const orderStatusSchema = z.enum(['PENDING', 'PROCESSING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
export const orderQuerySchema = paginationSchema.extend({ status: orderStatusSchema.optional() });
export const idempotencySchema = z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export type OrderCreate = z.infer<typeof createOrderSchema>;
