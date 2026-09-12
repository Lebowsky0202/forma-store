import type { RequestHandler } from 'express';
import type { User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { AppError, asyncRoute } from '../errors.js';

declare global {
  namespace Express {
    interface Request { user?: User }
  }
}

export const requireAuth: RequestHandler = asyncRoute(async (req, _res, next) => {
  const authorization = req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHORIZED', 'Войдите в аккаунт.');
  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(authorization.slice(7), config.JWT_SECRET, {
      algorithms: ['HS256'], issuer: 'forma-api', audience: 'forma-store',
    });
    if (typeof verified === 'string' || typeof verified.sub !== 'string' || typeof verified.version !== 'number') throw new Error('Invalid token');
    payload = verified;
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Сессия истекла. Войдите снова.');
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub! } });
  if (!user?.active || user.tokenVersion !== payload.version) throw new AppError(401, 'UNAUTHORIZED', 'Сессия недействительна. Войдите снова.');
  req.user = user;
  next();
});

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') return next(new AppError(403, 'FORBIDDEN', 'Доступ разрешён только администратору.'));
  next();
};
