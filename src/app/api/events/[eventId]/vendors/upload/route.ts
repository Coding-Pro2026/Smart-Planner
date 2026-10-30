import { Prisma } from "@prisma/client";
import { api, HttpError, requireEvent } from "@/lib/http";
import { db } from "@/lib/db";
import { extractPdfText, MAX_PDF_BYTES } from "@/lib/documents/pdf";
import { quoteTermsSchema, scanRiskClauses } from "@/lib/documents/quote-schema";
import { computeQuote } from "@/lib/engine/quotes";
import { generateStructured } from "@/lib/llm/structured";
import { resolveLlmConfig } from "@/lib/llm/resolve";
import { fenceUntrusted, sanitizeUntrusted, UNTRUSTED_NOTICE } from "@/lib/security/sanitize";
import { serializeVendor } from "@/lib/serialize";
import { audit } from "@/lib/services/common";

export const maxDuration = 120;

const SYSTEM = `You are the Vendor & Contract agent. Extract the commercial terms of a vendor quote or contract.
Rules:
- Copy figures exactly as printed. NEVER calculate totals; put the document's printed grand total in statedTotal if present.
- List EVERY fee as a line item or service charge. Set hiddenInSummary=true for charges that appear only in fine print, footnotes or terms.
- Capture gratuity/tip %, tax %, payment schedule (deposit, instalments, balance due dates), and cancellation / refund terms.
- Flag risk clauses (auto-renewal, non-refundable deposits, overtime, price escalation, liability waivers, exclusivity, harsh cancellation) with a short verbatim excerpt.
- If something is unclear or missing, leave it out and add a warning rather than guessing.
${UNTRUSTED_NOTICE}`;

export const POST = api({ raw: true, rate: { name: "quote-upload", limit: 10, windowMs: 60_000 } }, async ({ req, user, params }) => {
  const eventId = params.eventId!;
  await requireEvent(user.id, eventId, "write");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PDF_BYTES + 100_000) throw new HttpError(413, "PDF is larger than 10 MB");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a PDF in the `file` field");
  const vendorId = typeof form?.get("vendorId") === "string" ? String(form?.get("vendorId")) : undefined;
  const name = String(form?.get("name") ?? "").trim().slice(0, 120);
  const serviceType = String(form?.get("serviceType") ?? "").trim().slice(0, 60);

  if (vendorId && !(await db.vendor.findFirst({ where: { id: vendorId, eventId }, select: { id: true } }))) throw new HttpError(404, "Not found");
  const llm = await resolveLlmConfig(req, user.id); // fail fast before heavy parsing

  const text = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
  const doc = sanitizeUntrusted(text, 24_000);
  const terms = await generateStructured(llm, {
    tier: "reasoning",
    schema: quoteTermsSchema,
    schemaName: "quote_terms",
    system: SYSTEM,
    user: `Extract the terms from this document.\n${fenceUntrusted("document", doc.text)}`,
    maxTokens: 4000,
  });

  // Merge model-found risks with the deterministic regex backstop (dedupe by category).
  const have = new Set(terms.riskClauses.map((r) => r.category));
  const risks = [...terms.riskClauses, ...scanRiskClauses(doc.text).filter((r) => !have.has(r.category))];
  const warnings = [...terms.warnings];
  if (doc.truncated) warnings.push("Document was long; only the first 24,000 characters were analysed.");
  if (doc.flags.length) warnings.push(`The document contains text that looks like instructions to an AI (${doc.flags.join(", ")}). It was ignored.`);
  const final = { ...terms, riskClauses: risks, warnings };
  const computed = computeQuote(final);
  final.warnings.push(...computed.warnings);

  const displayName = name || final.vendorName || file.name.replace(/\.pdf$/i, "").slice(0, 120) || "Unnamed vendor";
  const data = {
    quoteAmount: computed.totalCents / 100,
    status: "quoted" as const,
    parsedTerms: { terms: final, computed, sourceFile: file.name.slice(0, 200), parsedAt: new Date().toISOString() } as unknown as Prisma.InputJsonObject,
  };
  const vendor = vendorId
    ? await db.vendor.update({ where: { id: vendorId }, data })
    : await db.vendor.create({ data: { eventId, name: displayName, serviceType: serviceType || final.serviceType || "General", ...data } });
  await audit(db, eventId, user.id, "vendor.quote_parsed", { vendorId: vendor.id, risks: risks.length });
  return { vendor: serializeVendor(vendor), computed };
});
