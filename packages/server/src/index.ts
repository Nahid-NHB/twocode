import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { chatRoute } from "./routes/chat";
import { sessionsRoute } from "./routes/sessions";

const app = new Hono();

const routes = app
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/sessions", sessionsRoute)
  .route("/chat", chatRoute);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export type AppType = typeof routes;

export default {
  port: 3000,
  // In-flight LLM streaming/tool-calling turns must not be killed by Bun's
  // default idle timeout.
  idleTimeout: 255,
  fetch: app.fetch,
};
