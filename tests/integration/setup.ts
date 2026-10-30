import { randomBytes } from "node:crypto";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/plangenie_test";
process.env.AUTH_SECRET = randomBytes(48).toString("base64url");
process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString("base64");
process.env.ALLOW_PRIVATE_LLM_ENDPOINTS = "false";
