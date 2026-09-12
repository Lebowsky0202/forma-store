import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

await prisma.$connect();
const server = app.listen(config.PORT, '0.0.0.0', () => { console.log(`FORMA API listening on port ${config.PORT}`); });
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('Stopping FORMA API');
  server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
