import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";

const E2E_DB = "postgresql://postgres:postgres@localhost:5432/plangenie_e2e";
const env = {
  DATABASE_URL: E2E_DB,
  AUTH_SECRET: randomBytes(48).toString("base64url"),
  ENCRYPTION_MASTER_KEY: randomBytes(32).toString("base64"),
  ALLOW_PRIVATE_LLM_ENDPOINTS: "true",
  PORT: "3100",
};

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] } },
  webServer: [
    { command: "node tests/e2e/fake-llm.mjs", port: 4010, reuseExistingServer: true },
    { command: `npx prisma db push --skip-generate && npx next start -p 3100`, port: 3100, env: { ...env, ...(process.env as Record<string, string>), DATABASE_URL: E2E_DB }, reuseExistingServer: false, timeout: 120_000 },
  ],
});
