import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/db/src/schema/index.ts",
  out: "./packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://beacon:beacon_dev@localhost:5432/beacon_os",
  },
});
