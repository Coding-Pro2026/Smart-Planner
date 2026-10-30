import type { CollaboratorRole } from "@prisma/client";
import { db } from "./db";

/**
 * Authorization. Tenant isolation rule: EVERY query for event-scoped data goes through
 * `getEventRole`, and every event-scoped table query additionally filters by `eventId`.
 * Unknown event and "no access" are indistinguishable (both 404) to prevent enumeration.
 */
export type Permission = "read" | "read_tasks" | "write" | "manage" | "delete_event";

const MATRIX: Record<CollaboratorRole, ReadonlySet<Permission>> = {
  owner: new Set(["read", "read_tasks", "write", "manage", "delete_event"]),
  editor: new Set(["read", "read_tasks", "write"]),
  viewer: new Set(["read", "read_tasks"]),
  // Vendors see the timeline only — never budget, guests, or other vendors' quotes.
  vendor: new Set(["read_tasks"]),
};

export const can = (role: CollaboratorRole | null | undefined, p: Permission): boolean => !!role && MATRIX[role].has(p);

export async function getEventRole(userId: string, eventId: string): Promise<CollaboratorRole | null> {
  const c = await db.collaborator.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { role: true } });
  return c?.role ?? null;
}
