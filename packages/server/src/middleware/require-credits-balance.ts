import { createMiddleware } from "hono/factory";

// Stub: real Polar balance checking (returning 402 when a user has no
// credits left) replaces the body of this function in Phase I. Routes
// call requireCreditsBalance in their middleware chain starting now so
// that swap requires no route changes later - only this file's internals.
export const requireCreditsBalance = createMiddleware(async (_c, next) => {
  await next();
});
