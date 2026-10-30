import { api, HttpError, requireEvent } from "@/lib/http";
import { compareInput } from "@/lib/schemas";
import { compareVendorQuotes } from "@/lib/services/quotes";

/** Deterministic (no LLM): compares already-parsed quotes side by side. */
export const POST = api({ body: compareInput }, async ({ user, params, body }) => {
  await requireEvent(user.id, params.eventId!, "read");
  const cmp = await compareVendorQuotes(params.eventId!, body.vendorIds);
  if (cmp.vendors.length < 2) throw new HttpError(422, "Select at least two vendors that have a parsed quote");
  return { comparison: cmp };
});
