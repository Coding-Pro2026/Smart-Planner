import { api } from "@/lib/http";
import { env } from "@/lib/env";

export const GET = api({}, async ({ user }) => ({ user, vaultEnabled: env.vaultEnabled }));
