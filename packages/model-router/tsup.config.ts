import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    /^@beacon-os\//,
    /^@anthropic-ai\//,
    /^openai$/,
    /^@google\//,
    /^drizzle/,
    /^pg$/,
    /^ioredis$/,
    /^pino$/,
    /^zod$/,
    /^ulid$/,
  ],
});
