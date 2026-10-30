import { z } from "zod";
import { db } from "../db";
import { compareQuotes } from "../engine/quotes";
import { quoteTermsSchema } from "../documents/quote-schema";

/** Tenant-scoped: only vendors belonging to `eventId` are ever loaded. */
export async function loadQuotes(eventId: string, vendorIds: string[]) {
  const vendors = await db.vendor.findMany({ where: { eventId, id: { in: vendorIds } } });
  const out: { vendorId: string; vendorName: string; terms: z.infer<typeof quoteTermsSchema> }[] = [];
  for (const v of vendors) {
    const p = quoteTermsSchema.safeParse((v.parsedTerms as { terms?: unknown } | null)?.terms);
    if (p.success) out.push({ vendorId: v.id, vendorName: v.name, terms: p.data });
  }
  return out;
}

export async function compareVendorQuotes(eventId: string, vendorIds: string[]) {
  return compareQuotes(await loadQuotes(eventId, vendorIds));
}
