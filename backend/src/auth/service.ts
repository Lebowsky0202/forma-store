import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import type { Response } from 'express';
import { config } from '../config.js';
import { prisma, serializable } from '../db.js';
import { AppError } from '../errors.js';

const refreshLifetime = 30 * 24 * 60 * 60 * 1000;
export const cookieName = 'forma_refresh';
const cookieOptions = { httpOnly: true, secure: config.isProduction, sameSite: 'lax' as const, path: '/api/auth' };
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const publicUser = (user: User) => ({
  id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, createdAt: user.createdAt,
});

function accessToken(user: User) {
  return jwt.sign({ version: user.tokenVersion }, config.JWT_SECRET, {
    algorithm: 'HS256', subject: user.id, expiresIn: '15m', issuer: 'forma-api', audience: 'forma-store',
  });
}

export async function newSession(user: User, res: Response) {
  const token = randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({ data: {
    tokenHash: hashToken(token), familyId: randomUUID(), userId: user.id,
    expiresAt: new Date(Date.now() + refreshLifetime),
  } });
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: refreshLifetime });
  return { user: publicUser(user), accessToken: accessToken(user) };
}

export async function rotateSession(token: string | undefined, res: Response) {
  if (!token || token.length > 200) throw new AppError(401, 'UNAUTHORIZED', 'Войдите в аккаунт.');
  const tokenHash = hashToken(token);
  const oldToken = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!oldToken) throw new AppError(401, 'UNAUTHORIZED', 'Сессия истекла. Войдите снова.');
  if (oldToken.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { familyId: oldToken.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie(cookieName, cookieOptions);
    throw new AppError(401, 'SESSION_REVOKED', 'Сессия отозвана. Войдите снова.');
  }
  const replacement = randomBytes(48).toString('base64url');
  const user = await serializable(async (tx) => {
    const changed = await tx.refreshToken.updateMany({
      where: { id: oldToken.id, revokedAt: null, expiresAt: { gt: new Date() }, user: { active: true } },
      data: { revokedAt: new Date() },
    });
    if (changed.count !== 1) throw new AppError(401, 'UNAUTHORIZED', 'Сессия истекла. Войдите снова.');
    const currentUser = await tx.user.findUniqueOrThrow({ where: { id: oldToken.userId } });
    await tx.refreshToken.create({ data: {
      userId: currentUser.id, tokenHash: hashToken(replacement), familyId: oldToken.familyId,
      expiresAt: new Date(Date.now() + refreshLifetime),
    } });
    return currentUser;
  });
  res.cookie(cookieName, replacement, { ...cookieOptions, maxAge: refreshLifetime });
  return { user: publicUser(user), accessToken: accessToken(user) };
}

export async function revokeSession(token: string | undefined, res: Response) {
  if (token && token.length <= 200) {
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (existing) await prisma.refreshToken.updateMany({ where: { familyId: existing.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  res.clearCookie(cookieName, cookieOptions);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
// A non-secret hash used to equalize the password-check cost for unknown accounts.
const dummyHash = bcrypt.hashSync('forma-unknown-account', 12);
export async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !user.active || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
  return user;
}
