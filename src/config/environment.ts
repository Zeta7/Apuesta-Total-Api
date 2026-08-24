import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().min(1).default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  AWS_SQS_ENDPOINT: z.string().url().optional(),
  SQS_AUDIT_QUEUE_URL: z.string().url(),
  SQS_NOTIFICATION_QUEUE_URL: z.string().url(),
  SQS_WAIT_TIME_SECONDS: z.coerce.number().int().min(0).max(20).default(10),
  SQS_VISIBILITY_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1h'),
  MIN_STAKE: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default('1.00'),
  MAX_STAKE: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default('1000.00'),
  DEFAULT_CURRENCY: z.string().length(3).default('PEN'),
  EVENTS_CACHE_TTL: z.coerce.number().int().positive().default(60),
  DEFAULT_FOOTBALL_EVENT_DURATION_MINUTES: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  OUTBOX_PROCESSING_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  return environmentSchema.parse(input);
}
