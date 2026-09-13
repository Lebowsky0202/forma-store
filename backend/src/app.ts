import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { prisma } from './db.js';
import { AppError, asyncRoute, errorHandler } from './errors.js';
import { authRouter } from './auth/routes.js';
import { usersRouter } from './users/routes.js';
import { productsRouter } from './products/routes.js';
import { categoriesRouter } from './categories/routes.js';
import { cartRouter } from './cart/routes.js';
import { favoritesRouter } from './favorites/routes.js';
import { ordersRouter } from './orders/routes.js';
import { reviewsRouter } from './reviews/routes.js';
import { adminRouter } from './admin/routes.js';
import { uploadsRouter } from './uploads/routes.js';
import { frontendRouter } from './frontend.js';

export const app = express();
app.disable('x-powered-by');
if (config.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'] }));
app.use((req, _res, next) => {
  const origin = req.header('Origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin && origin !== config.CORS_ORIGIN) return next(new AppError(403, 'INVALID_ORIGIN', 'Недопустимый источник запроса.'));
  next();
});
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use('/uploads', express.static(config.uploadDir, { dotfiles: 'deny', immutable: true, maxAge: '30d', index: false }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1200, standardHeaders: 'draft-7', legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: { code: 'RATE_LIMITED', message: 'Слишком много запросов. Попробуйте позже.' } },
}));
app.get('/api/health', asyncRoute(async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; }
  catch { throw new AppError(503, 'DATABASE_UNAVAILABLE', 'База данных временно недоступна.'); }
  res.json({ status: 'ok', database: 'connected' });
}));
app.get('/api/shipping-methods', asyncRoute(async (_req, res) => {
  res.json(await prisma.shippingMethod.findMany({ where: { active: true }, select: { id: true, name: true, description: true, price: true, estimatedDays: true }, orderBy: { price: 'asc' } }));
}));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', reviewsRouter);
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/cart', cartRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/uploads', uploadsRouter);
if (config.frontendDir) app.use(frontendRouter(config.frontendDir));
app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Страница не найдена.')));
app.use(errorHandler);
