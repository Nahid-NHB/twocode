import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client";

// Root .env is not inside this package, so load it explicitly rather than
// relying on a package-local .env that doesn't exist.
loadEnv({ path: resolve(import.meta.dirname, "../../../.env") });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg(databaseUrl);

export const db = new PrismaClient({ adapter });
