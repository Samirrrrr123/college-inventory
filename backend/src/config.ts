import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  CLIENT_ORIGIN: z.url(),
  ACCESS_SECRET: z.string().min(32),
  REFRESH_SECRET: z.string().min(32),
});

export function loadConfig(environment: NodeJS.ProcessEnv) {
  const config = schema.parse(environment);
  if (config.ACCESS_SECRET === config.REFRESH_SECRET)
    throw new Error('Access and refresh secrets must differ');
  if (new URL(config.CLIENT_ORIGIN).origin !== config.CLIENT_ORIGIN)
    throw new Error('CLIENT_ORIGIN must contain only the origin');
  return config;
}

export type Config = ReturnType<typeof loadConfig>;
