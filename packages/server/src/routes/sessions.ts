import { zValidator } from "@hono/zod-validator";
import { db } from "@twocode/database/client";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { requireAuth } from "../middleware/require-auth";
import { requireCreditsBalance } from "../middleware/require-credits-balance";

const createSessionSchema = z.object({
  title: z.string().min(1),
});

export const sessionsRoute = new Hono<AuthenticatedEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const userId = c.get("userId");

    const sessions = await db.session.findMany({
      where: { userId },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return c.json(sessions);
  })
  .get("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const session = await db.session.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new HTTPException(404, { message: "Session not found" });
    }

    return c.json(session);
  })
  .post("/", requireCreditsBalance, zValidator("json", createSessionSchema), async (c) => {
    const userId = c.get("userId");
    const { title } = c.req.valid("json");

    const session = await db.session.create({
      data: { userId, title },
    });

    return c.json(session, 201);
  });
