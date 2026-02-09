import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "@beacon-os/auth";
import { errorHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { health } from "./routes/health.js";
import { agents } from "./routes/agents.js";
import { runs } from "./routes/runs.js";
import { tools } from "./routes/tools.js";

export function createApp() {
  const app = new Hono();

  // Global middleware
  app.use("*", logger());
  app.use("*", cors());
  app.use("*", requestIdMiddleware());

  // Error handler
  app.onError(errorHandler);

  // Health check (unauthenticated)
  app.route("/api/v1/health", health);

  // Authenticated routes
  app.use("/api/v1/*", authMiddleware());
  app.route("/api/v1/agents", agents);
  app.route("/api/v1", runs);
  app.route("/api/v1/tools", tools);

  return app;
}
