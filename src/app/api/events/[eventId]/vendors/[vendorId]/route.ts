import { api, notFound, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { vendorPatch } from "@/lib/schemas";
import { serializeVendor } from "@/lib/serialize";

export const PATCH = api({ body: vendorPatch }, async ({ user, params, body }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  const r = await db.vendor.updateMany({ where: { id: params.vendorId!, eventId }, data: body });
  if (r.count === 0) throw notFound();
  return { vendor: serializeVendor(await db.vendor.findUniqueOrThrow({ where: { id: params.vendorId! } })) };
});

export const DELETE = api({}, async ({ user, params }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  const r = await db.vendor.deleteMany({ where: { id: params.vendorId!, eventId } });
  if (r.count === 0) throw notFound();
  return { ok: true };
});
