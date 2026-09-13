import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ path: ['../.env', '.env'] });

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  CORS_ORIGIN: z.string().url().default(process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173')
    .transform((value) => new URL(value).origin),
  UPLOAD_DIR: z.string().optional(),
  FRONTEND_DIR: z.string().min(1).optional(),
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
}
export const config = {
  ...parsed.data,
  uploadDir: path.resolve(parsed.data.UPLOAD_DIR ?? 'uploads'),
  frontendDir: parsed.data.FRONTEND_DIR ? path.resolve(parsed.data.FRONTEND_DIR) : undefined,
  isProduction: parsed.data.NODE_ENV === 'production',
};
