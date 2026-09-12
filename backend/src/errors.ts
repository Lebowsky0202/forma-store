import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const asyncRoute = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Проверьте заполненные поля.', details: error.flatten() } });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: { code: 'INVALID_UPLOAD', message: error.code === 'LIMIT_FILE_SIZE' ? 'Размер изображения не должен превышать 5 МБ.' : 'Не удалось загрузить изображение.' } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped: Record<string, [number, string, string]> = {
      P2002: [409, 'CONFLICT', 'Запись с такими данными уже существует.'],
      P2003: [409, 'RELATION_CONFLICT', 'Запись связана с другими данными.'],
      P2025: [404, 'NOT_FOUND', 'Запись не найдена.'],
      P2034: [409, 'CONCURRENT_UPDATE', 'Данные изменились. Повторите действие.'],
    };
    const known = mapped[error.code];
    if (known) {
      res.status(known[0]).json({ error: { code: known[1], message: known[2] } });
      return;
    }
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Некорректный JSON.' } });
    return;
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Слишком большой запрос.' } });
    return;
  }
  // Avoid logging request bodies or authentication headers.
  console.error('Unhandled API error:', error instanceof Error ? error.message : 'Unknown error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Не удалось выполнить запрос. Попробуйте ещё раз.' } });
};
