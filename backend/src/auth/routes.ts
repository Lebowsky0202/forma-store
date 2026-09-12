import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncRoute } from '../errors.js';
import { requireAuth } from './middleware.js';
import { cookieName, hashPassword, newSession, publicUser, revokeSession, rotateSession, verifyLogin } from './service.js';

export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Слишком много попыток. Попробуйте через 15 минут.' } },
});
const emailSchema = z.string().trim().email().max(254).toLowerCase();
const passwordSchema = z.string().min(10, 'Пароль должен содержать минимум 10 символов').max(72)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Пароль слишком длинный');
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) }).strict();
const registrationSchema = z.object({ email: emailSchema, password: passwordSchema, name: z.string().trim().min(2).max(120) }).strict();

authRouter.post('/register', authLimiter, asyncRoute(async (req, res) => {
  const data = registrationSchema.parse(req.body);
  const user = await prisma.user.create({ data: {
    email: data.email, name: data.name, passwordHash: await hashPassword(data.password), cart: { create: {} },
  } });
  res.status(201).json(await newSession(user, res));
}));
authRouter.post('/login', authLimiter, asyncRoute(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await verifyLogin(data.email, data.password);
  res.json(await newSession(user, res));
}));
authRouter.post('/refresh', asyncRoute(async (req, res) => {
  const token: unknown = req.cookies[cookieName];
  res.json(await rotateSession(typeof token === 'string' ? token : undefined, res));
}));
authRouter.post('/logout', asyncRoute(async (req, res) => {
  const token: unknown = req.cookies[cookieName];
  await revokeSession(typeof token === 'string' ? token : undefined, res);
  res.json({ success: true });
}));
authRouter.get('/me', requireAuth, asyncRoute(async (req, res) => { res.json(publicUser(req.user!)); }));
