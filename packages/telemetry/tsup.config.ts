import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    /^@beacon-os\//,
    /^@opentelemetry\//,
    /^drizzle/,
    /^pg$/,
    /^ioredis$/,
    /^pino$/,
    /^hono/,
    /^zod$/,
    /^ulid$/,
  ],
});
