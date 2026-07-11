// Package entry point. The Hono app starts in Milestone 10.

// Temporary proof that a cross-package import resolves through the
// workspace with no build step. Removed once Milestone 10 replaces this
// file with the real Hono app.
import { WORKSPACE_RESOLUTION_CHECK } from "@twocode/shared";

console.log(WORKSPACE_RESOLUTION_CHECK);
