import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16),
  JWT_ISSUER: z.string().default("beacon-os"),
  JWT_AUDIENCE: z.string().default("beacon-os-api"),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      const formatted = result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid environment variables:\n${formatted}`);
    }
    _env = result.data;
  }
  return _env;
}

export function resetEnv(): void {
  _env = null;
}
