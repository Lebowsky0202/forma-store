import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const args of [
  ['ci', '--include=dev', '--workspace=backend', '--workspace=frontend', '--include-workspace-root=false'],
  ['run', 'db:generate', '-w', 'backend'],
  ['run', 'build', '-w', 'backend'],
  ['run', 'build', '-w', 'frontend'],
]) {
  const result = spawnSync(npm, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
