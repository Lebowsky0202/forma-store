import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parse } from 'dotenv';

const runControl = (file, args) => new Promise((resolveCommand, rejectCommand) => {
  const child = spawn(file, args, { windowsHide: true, stdio: 'ignore' });
  child.once('error', rejectCommand);
  child.once('exit', code => code === 0 ? resolveCommand() : rejectCommand(new Error(`pg_ctl exited ${code}; see .local/postgres.log`)));
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
if (!existsSync(envPath)) throw new Error('Run npm run setup:env first.');
const values = parse(readFileSync(envPath));
const url = new URL(values.DATABASE_URL);
const databasePort = Number(url.port || 5432);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local DB requires a loopback DATABASE_URL.');
const databaseName = url.pathname.slice(1);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(databaseName)) throw new Error('Invalid local database name.');
const dataDir = resolve(root, '.local/postgres');
mkdirSync(dirname(dataDir), { recursive: true });
const postgres = new EmbeddedPostgres({
  databaseDir: dataDir, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  port: databasePort, persistent: true, authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'],
  onLog: message => console.log(String(message).trim()), onError: message => console.error(String(message)),
});
if (!existsSync(resolve(dataDir, 'PG_VERSION'))) await postgres.initialise();
let stopDatabase;
if (process.platform === 'win32') {
  // pg_ctl drops administrative privileges correctly on Windows; the package's
  // direct postgres spawn does not. Explicit args avoid shell path escaping.
  const { pg_ctl } = await import('@embedded-postgres/windows-x64');
  let alreadyRunning = false;
  try { await runControl(pg_ctl, ['-D', dataDir, 'status']); alreadyRunning = true; } catch { /* A stopped cluster is expected on first run. */ }
  if (!alreadyRunning) await runControl(pg_ctl, ['-D', dataDir, '-l', resolve(root, '.local/postgres.log'),
    '-o', `-p ${databasePort} -h 127.0.0.1`, '-w', 'start']);
  stopDatabase = () => runControl(pg_ctl, ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
} else {
  await postgres.start();
  stopDatabase = () => postgres.stop();
}
const client = postgres.getPgClient('postgres', '127.0.0.1');
await client.connect();
if (!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount) {
  await client.query(`CREATE DATABASE "${databaseName}"`);
}
const version = await client.query('SELECT version()');
await client.end();
console.log(`${version.rows[0].version.split(' on ')[0]} ready on 127.0.0.1:${databasePort}, database ${databaseName}.`);
console.log('Persistent data: .local/postgres. Stop with Ctrl+C.');
let stopping = false;
const keepAlive = setInterval(() => {}, 60_000);
const stop = async () => {
  if (stopping) return;
  stopping = true; clearInterval(keepAlive);
  await stopDatabase(); process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
