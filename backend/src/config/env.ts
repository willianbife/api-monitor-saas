import { z } from "zod";

const parseOrigins = (value: string) =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ""));

const parseBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return value;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  FRONTEND_URLS: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  ENABLE_MONITOR_WORKER: z.preprocess(parseBoolean, z.boolean().optional()),
  JWT_SECRET_CURRENT: z
    .string()
    .min(32, "JWT_SECRET_CURRENT must be at least 32 characters"),
  JWT_SECRET_PREVIOUS: z.string().min(32).optional().or(z.literal("")),
  JWT_ISSUER: z.string().default("api-monitor-saas"),
  JWT_AUDIENCE: z.string().default("api-monitor-saas-web"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration", parsedEnv.error.flatten().fieldErrors);
  throw new Error("Server configuration is invalid");
}

export const env = {
  ...parsedEnv.data,
  FRONTEND_URLS: Array.from(
    new Set(
      parseOrigins(
        parsedEnv.data.FRONTEND_URLS ||
          parsedEnv.data.FRONTEND_URL ||
          "http://localhost:5173"
      )
    )
  ),
  ENABLE_MONITOR_WORKER:
    parsedEnv.data.ENABLE_MONITOR_WORKER ?? parsedEnv.data.NODE_ENV !== "production",
  JWT_SECRET_PREVIOUS: parsedEnv.data.JWT_SECRET_PREVIOUS || undefined,
};

export const isProduction = env.NODE_ENV === "production";
