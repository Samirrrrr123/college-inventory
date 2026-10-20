import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';
import { AuthRepository } from './auth/repository.js';
import { AuthService } from './auth/service.js';
import { createApp } from './app.js';

const config = loadConfig(process.env);
const db = new PrismaClient();
await db.$connect();
const service = new AuthService(new AuthRepository(db), config, (url) => {
  console.log('Password reset link:', url);
});
const server = createApp(service, config).listen(config.PORT, '0.0.0.0', () => {
  console.log(`Inventory API listening on port ${config.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
