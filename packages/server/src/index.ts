import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  port: 3000,
  fetch: app.fetch,
};
