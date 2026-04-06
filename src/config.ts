import 'dotenv/config'
import { z } from 'zod'

export const envSchema = z.object({
  PORT: z
    .coerce
    .number()
    .int()
    .min(1, { message: 'PORT must be >= 1' })
    .max(65535, { message: 'PORT must be <= 65535' })
    .default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform(s => s.split(',').map(o => o.trim()).filter(Boolean)),
})

export type EnvConfig = z.infer<typeof envSchema>

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment configuration:')
  console.error(result.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = result.data
