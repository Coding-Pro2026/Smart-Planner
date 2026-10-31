import type { ParsedVendorTerms } from '../types/domain';

/**
 * Deterministic vendor-quote analyser. Reads the pasted quote text and extracts
 * the real numbers (base fee, service charge, gratuity, tax), payment schedule,
 * cancellation language, hidden fees, risky clauses and line items.
 */

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const toNum = (s: string) => Number(String(s).replace(/[$,\s]/g, ''));

interface Amount {
  value: number;
  line: string;
}

function findAmounts(text: string): Amount[] {
  const out: Amount[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const re = /\$\s*([\d,]+(?:\.\d{1,2})?)\s*(k\b)?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      let v = toNum(m[1]);
      if (m[2]) v *= 1000;
      if (Number.isFinite(v) && v > 0) out.push({ value: v, line });
    }
  }
  return out;
}

function pct(text: string, labels: RegExp): number | null {
  // "service charge 20%", "20% service charge", "gratuity of 18 %"
  const before = new RegExp(`(?:${labels.source})[^\\n\\d%$]{0,25}?(\\d{1,2}(?:\\.\\d+)?)\\s*%`, 'i').exec(text);
  if (before) return Number(before[1]);
  const after = new RegExp(`(\\d{1,2}(?:\\.\\d+)?)\\s*%\\s*(?:mandatory\\s+|automatic\\s+)?(?:${labels.source})`, 'i').exec(text);
  if (after) return Number(after[1]);
  return null;
}

export function parseQuoteText(
  raw: string,
  opts: { serviceType?: string } = {}
): ParsedVendorTerms {
  // Cap input: the server already limits to 20k chars; this keeps worst-case regex time bounded.
  const text = String(raw ?? '').slice(0, 20_000);
  const lower = text.toLowerCase();
  const amounts = findAmounts(text);

  // ---- base fee -------------------------------------------------------------
  const isFeeLine = (l: string) =>
    /(base|package|total|subtotal|price|rental|fee|rate|investment|quote|cost|retainer)/i.test(l) &&
    !/(deposit|late|overtime|cleaning|corkage|delivery|travel|admin|surcharge|tax|gratuity|service charge|tip)/i.test(l);
  const labelled = amounts.filter((a) => isFeeLine(a.line));
  const base =
    labelled.length > 0
      ? Math.max(...labelled.slice(0, 4).map((a) => a.value))
      : amounts.length > 0
        ? Math.max(...amounts.map((a) => a.value))
        : 0;

  const svc = pct(text, /service\s*(?:charge|fee)|admin(?:istration)?\s*fee|production\s*fee|management\s*fee/) ?? 0;
  const grat = pct(text, /gratuity|tip|staff\s*charge/) ?? 0;
  const tax = pct(text, /(?:sales\s*)?tax|vat|gst/) ?? 0;

  const total = Math.round(base * (1 + (svc + grat + tax) / 100) * 100) / 100;

  // ---- hidden / flat fees ----------------------------------------------------
  const hidden: string[] = [];
  if (svc > 0) hidden.push(`${svc}% service / administration charge`);
  if (grat > 0) hidden.push(`${grat}% mandatory gratuity`);
  const flatFees: { description: string; amount: number }[] = [];
  const feeWords = /(overtime|late|cleaning|corkage|delivery|travel|setup|set-up|strike|load-?out|parking|permit|insurance|cancellation|rush|security|equipment|breakage|fuel|mileage)/i;
  for (const a of amounts) {
    if (a.value === base) continue;
    if (feeWords.test(a.line) && /fee|charge|surcharge|extra|additional|per hour|hourly|cost/i.test(a.line)) {
      const desc = a.line.replace(/^[-•*\d.)\s]+/, '').replace(/\s+/g, ' ').slice(0, 90);
      hidden.push(`${money(a.value)} — ${desc}`);
      flatFees.push({ description: desc, amount: a.value });
    }
  }
  const flatTotal = flatFees.reduce((s, f) => s + f.amount, 0);
  const trueCost = Math.round((total + flatTotal) * 100) / 100;

  // ---- payment schedule -------------------------------------------------------
  const schedule: string[] = [];
  const depositPct = /(\d{1,2})\s*%\s*(?:deposit|retainer|down\s*payment|upfront|advance)/i.exec(text) || /(?:deposit|retainer|down\s*payment)[^\n\d]{0,20}(\d{1,2})\s*%/i.exec(text);
  const depositAmt = /(?:deposit|retainer|down\s*payment)[^\n$]{0,25}\$\s*([\d,]+)/i.exec(text);
  if (depositPct) {
    const d = Number(depositPct[1]);
    schedule.push(`${d}% deposit / retainer on signing (${money((trueCost * d) / 100)})`);
    schedule.push(`${100 - d}% balance before the event (${money((trueCost * (100 - d)) / 100)})`);
  } else if (depositAmt) {
    const d = toNum(depositAmt[1]);
    schedule.push(`${money(d)} deposit on signing`);
    schedule.push(`${money(Math.max(0, trueCost - d))} balance before the event`);
  } else {
    schedule.push('No payment schedule stated — ask for deposit % and final-payment date in writing.');
  }
  const net = /net\s*(\d{1,3})|due\s*(?:within|in)\s*(\d{1,3})\s*days/i.exec(text);
  if (net) schedule.push(`Invoices due within ${net[1] ?? net[2]} days`);

  // ---- cancellation -------------------------------------------------------------
  let cancellation = 'Not stated — request an explicit cancellation and rescheduling policy.';
  const cancelSentence = text.split(/\n+|(?<=[.!?])\s+/).find((s) => /cancel|refund|non-?refundable/i.test(s));
  if (cancelSentence) cancellation = cancelSentence.trim().slice(0, 240);

  // ---- risk clauses ---------------------------------------------------------------
  const risks: ParsedVendorTerms['risk_clauses'] = [];
  const add = (clause: string, severity: 'low' | 'medium' | 'high', recommendation: string) =>
    risks.push({ clause, severity, recommendation });
  if (/non-?refundable/.test(lower)) add('Non-refundable deposit or payments', 'high', 'Negotiate a partial refund window or the ability to apply the deposit to a rescheduled date.');
  if (/auto-?renew|automatically renew/.test(lower)) add('Automatic renewal language', 'medium', 'Strike auto-renewal or add a 30-day written opt-out.');
  if (/substitut/.test(lower)) add('Vendor may substitute materials / items', 'medium', 'Require written approval for any substitution of key items.');
  if (/exclusiv/.test(lower)) add('Exclusivity requirement', 'medium', 'Confirm exclusivity is limited to this event and does not restrict other vendors.');
  if (/not\s+(?:be\s+)?liable|waive|indemnif|hold harmless/.test(lower)) add('Liability waiver / indemnification', 'high', 'Have the clause reviewed; ensure the vendor carries their own liability insurance.');
  if (/overtime|per\s*hour|hourly/.test(lower)) add('Open-ended overtime or hourly charges', 'medium', 'Ask for a cap on overtime and an agreed end time.');
  if (/price\s*(?:is\s*)?subject to change|prices? may (?:change|increase)|subject to change/.test(lower)) add('Prices may change after signing', 'high', 'Lock the price in writing; add a not-to-exceed clause.');
  if (/travel|mileage|fuel/.test(lower)) add('Travel / mileage billed separately', 'low', 'Ask for travel to be included or capped.');
  if (!/force majeure|act of god|weather/.test(lower)) add('No force-majeure / weather clause', 'medium', 'Request clear terms for weather, illness or venue closure.');
  if (!/insur/.test(lower)) add('No mention of vendor insurance', 'low', 'Ask for a certificate of insurance (COI) naming the venue.');
  if (svc + grat >= 25) add(`High combined service charge + gratuity (${svc + grat}%)`, 'high', 'Negotiate the service charge down or ask for it to be folded into the base price.');

  // ---- line items --------------------------------------------------------------------
  const lineItems: ParsedVendorTerms['line_items'] = [
    { description: `${opts.serviceType || 'Core package'} — base scope`, amount: base, included: true },
  ];
  if (svc > 0) lineItems.push({ description: `Service charge (${svc}%)`, amount: Math.round(base * svc) / 100, included: false });
  if (grat > 0) lineItems.push({ description: `Gratuity (${grat}%)`, amount: Math.round(base * grat) / 100, included: false });
  if (tax > 0) lineItems.push({ description: `Tax (${tax}%)`, amount: Math.round(base * tax) / 100, included: false });
  for (const f of flatFees) lineItems.push({ description: f.description, amount: f.amount, included: false });

  return {
    base_fee: base,
    service_charge_pct: svc,
    gratuity_pct: grat,
    tax_pct: tax,
    total_true_cost: trueCost,
    payment_schedule: schedule,
    cancellation_policy: cancellation,
    hidden_fees_detected: hidden,
    risk_clauses: risks.slice(0, 8),
    line_items: lineItems,
  };
}
