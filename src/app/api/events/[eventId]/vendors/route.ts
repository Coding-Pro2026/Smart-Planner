import { api, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { vendorInput } from "@/lib/schemas";
import { serializeVendor } from "@/lib/serialize";
import { audit } from "@/lib/services/common";

export const GET = api({}, async ({ user, params }) => {
  await requireEvent(user.id, params.eventId!, "read");
  return { vendors: (await db.vendor.findMany({ where: { eventId: params.eventId! }, orderBy: { name: "asc" } })).map(serializeVendor) };
});

export const POST = api({ body: vendorInput }, async ({ user, params, body }) => {
  const id = params.eventId!;
  await requireEvent(user.id, id, "write");
  const v = await db.vendor.create({ data: { ...body, quoteAmount: body.quoteAmount ?? null, eventId: id } });
  await audit(db, id, user.id, "vendor.added", { vendorId: v.id });
  return { vendor: serializeVendor(v) };
});
