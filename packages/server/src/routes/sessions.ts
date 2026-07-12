import { db } from "@twocode/database/client";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { requireAuth } from "../middleware/require-auth";

export const sessionsRoute = new Hono<AuthenticatedEnv>();

sessionsRoute.use("*", requireAuth);

sessionsRoute.get("/", async (c) => {
  const userId = c.get("userId");

  const sessions = await db.session.findMany({
    where: { userId },
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return c.json(sessions);
});

sessionsRoute.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const session = await db.session.findFirst({
    where: { id, userId },
  });

  if (!session) {
    throw new HTTPException(404, { message: "Session not found" });
  }

  return c.json(session);
});
