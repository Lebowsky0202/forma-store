import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, '.env');
if (existsSync(envFile)) {
  console.log('Existing .env preserved.');
} else {
  const dbPassword = randomBytes(24).toString('hex');
  const adminPassword = randomBytes(18).toString('base64url');
  const userPassword = randomBytes(18).toString('base64url');
  const env = [
    'NODE_ENV=development', 'PORT=4000', 'CORS_ORIGIN=http://localhost:5173',
    `DATABASE_URL=postgresql://forma:${dbPassword}@127.0.0.1:55432/forma?schema=public`,
    `JWT_SECRET=${randomBytes(48).toString('hex')}`,
    `SEED_ADMIN_PASSWORD=${adminPassword}`, `SEED_USER_PASSWORD=${userPassword}`,
    'UPLOAD_DIR=uploads', 'POSTGRES_USER=forma', `POSTGRES_PASSWORD=${dbPassword}`,
    'POSTGRES_DB=forma', 'WEB_PORT=8080', '',
  ].join('\n');
  writeFileSync(envFile, env, { mode: 0o600, flag: 'wx' });
  mkdirSync(resolve(root, '.local'), { recursive: true });
  writeFileSync(resolve(root, '.local/credentials.md'),
    `# Локальные аккаунты FORMA\n\nТолько для разработки; файл исключён из Git.\n\n| Роль | Email | Пароль |\n|---|---|---|\n| Администратор | admin@forma.local | ${adminPassword} |\n| Покупатель | user@forma.local | ${userPassword} |\n`, { mode: 0o600 });
  console.log('Created .env and .local/credentials.md with unique random credentials.');
}
// Prisma CLI resolves its .env relative to the backend workspace.
mkdirSync(resolve(root, 'backend'), { recursive: true });
writeFileSync(resolve(root, 'backend/.env'), readFileSync(envFile), { mode: 0o600 });
console.log('Synced backend/.env for Prisma CLI.');
