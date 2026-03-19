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
})

export type EnvConfig = z.infer<typeof envSchema>

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment configuration:')
  console.error(result.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = result.data
