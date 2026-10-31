import { Prisma } from "@prisma/client";
import { db } from "../db";
import { toISODate } from "../engine/dates";
import { queueSignal, topicFor } from "../realtime";

export type Tx = Prisma.TransactionClient;
export const num = (d: Prisma.Decimal | number | null | undefined): number => (d == null ? 0 : Number(d));
export const isoDate = (d: Date) => toISODate(d);
export const parseDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export async function audit(client: Tx | typeof db, eventId: string, actorId: string | null, action: string, metadata?: Prisma.InputJsonValue) {
  await client.auditLog.create({ data: { eventId, actorId, action, metadata } });
  queueSignal(eventId, topicFor(action));
  // An accepted proposal can touch tasks, budget and theme at once.
  if (action === "proposal.applied") for (const t of ["tasks", "budget", "event"] as const) queueSignal(eventId, t);
}
