import { createMiddleware } from "hono/factory";

export type AuthenticatedEnv = {
  Variables: {
    userId: string;
  };
};

// Stub: real Clerk OAuth token verification replaces the body of this
// function in Phase H. Every downstream route only ever reads
// c.get("userId") - it never touches Clerk directly - so swapping this
// implementation later requires no route changes.
export const requireAuth = createMiddleware<AuthenticatedEnv>(async (c, next) => {
  c.set("userId", "dev-user");
  await next();
});
