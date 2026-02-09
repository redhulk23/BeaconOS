import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = parseInt(process.env.PORT ?? "3000");
const app = createApp();

console.log(`BeaconOS API starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`BeaconOS API running at http://localhost:${port}`);
