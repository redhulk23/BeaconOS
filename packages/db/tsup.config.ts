import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    /^@beacon-os\//,
    /^drizzle/,
    /^pg$/,
    /^ioredis$/,
    /^pino$/,
    /^jose$/,
    /^bcrypt$/,
    /^hono/,
    /^zod$/,
    /^ulid$/,
  ],
});
