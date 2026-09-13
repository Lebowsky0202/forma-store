import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
process.env.FRONTEND_DIR = path.join(root, 'frontend', 'dist');
// Render injects its final https URL; an explicit CORS_ORIGIN supports a later custom domain.
const origin = process.env.CORS_ORIGIN || process.env.RENDER_EXTERNAL_URL;
if (!origin) throw new Error('Set CORS_ORIGIN or RENDER_EXTERNAL_URL before starting the public demo.');
process.env.CORS_ORIGIN = origin;
if (!process.env.UPLOAD_DIR) throw new Error('Set UPLOAD_DIR to the persistent disk mount path.');

// The uploads disk is mounted only at runtime, so the idempotent seed runs here, not during build.
for (const args of [
  [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy', '--schema', 'backend/prisma/schema.prisma'],
  ['--import', 'tsx', 'backend/prisma/seed.ts'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Import in this process so Render's SIGTERM reaches the existing graceful shutdown handler.
await import(pathToFileURL(path.join(root, 'backend', 'dist', 'src', 'server.js')).href);
