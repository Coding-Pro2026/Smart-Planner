// Minimal OpenAI-compatible server used by the E2E suite. Deterministic canned answers keyed on the requested schema.
import http from "node:http";

const reply = (o) => ({ choices: [{ message: { content: JSON.stringify(o) } }] });

function answer(body) {
  const sys = body.messages[0].content;
  const user = typeof body.messages[1].content === "string" ? body.messages[1].content : body.messages[1].content.map((p) => p.text ?? "").join("");
  if (sys.includes("health check")) return { ok: true };
  if (sys.includes("Supervisor")) {
    const msg = /<untrusted_user_message>\n([\s\S]*?)\n<\/untrusted_user_message>/.exec(user)?.[1] ?? "";
    if (/theme|mood/i.test(msg)) return { delegations: [{ agent: "theme", instruction: "palette" }] };
    return { delegations: [{ agent: "logistics", instruction: "tasks" }, { agent: "budget", instruction: "items" }] };
  }
  if (sys.includes("Theme & Ideation") && sys.includes('"colors"')) {
    return { colors: [{ hex: "#C8A2C8", name: "Lilac" }, { hex: "#c8a2c8", name: "dupe" }, { hex: "#2F4F4F", name: "Slate" }], styleKeywords: ["boho"], decorElements: ["pampas grass"], dietarySuggestions: ["vegan canapés"], summary: "Soft boho lilac." };
  }
  if (sys.includes("Theme & Ideation")) return { reply: "Here are theme ideas.", toolCalls: [], warnings: [] };
  if (sys.includes("Logistics")) return { reply: "Added a florist plan.", warnings: [], toolCalls: [
    { tool: "create_task", args: { title: "Book florist", category: "Decor & Flowers", daysBeforeEvent: 150, durationDays: 7, dependsOn: [] } },
    { tool: "create_task", args: { title: "Florist final proof", category: "Decor & Flowers", daysBeforeEvent: 40, durationDays: 3, dependsOn: ["Book florist"] } } ] };
  if (sys.includes("Budget Allocator")) return { reply: "Budget items drafted.", warnings: [], toolCalls: [{ tool: "add_budget_item", args: { name: "Bridal bouquet", category: "Decor & Flowers", unitCost: 250, quantity: 1, taxPct: 7, contingencyPct: 10 } }] };
  if (sys.includes("Vendor & Contract")) {
    // Quote extraction: choose figures by vendor named in the document text.
    const cheap = /Bloom/.test(user);
    return cheap
      ? { vendorName: "Bloom & Co", serviceType: "Florist", lineItems: [{ description: "Ceremony florals", amount: 1800 }, { description: "Reception centerpieces", quantity: 10, unitPrice: 90, amount: 900 }], serviceCharges: [{ name: "Delivery & setup", amount: 250, mandatory: true, hiddenInSummary: true }], taxPct: 0, gratuityPct: 0, statedTotal: 2700, paymentSchedule: [{ label: "Deposit", pct: 50, due: "On signing" }], cancellationTerms: "Deposit is non-refundable.", riskClauses: [], warnings: [] }
      : { vendorName: "Petal Pushers", serviceType: "Florist", lineItems: [{ description: "Ceremony florals", amount: 2000 }, { description: "Reception centerpieces", quantity: 10, unitPrice: 100, amount: 1000 }, { description: "Bridal bouquet", amount: 200 }], serviceCharges: [], taxPct: 0, gratuityPct: 0, statedTotal: 3200, paymentSchedule: [{ label: "Deposit", amount: 800, due: "On signing" }, { label: "Balance", amount: 2400, due: "14 days before" }], cancellationTerms: "Full refund up to 60 days out.", riskClauses: [], warnings: [] };
  }
  return { ok: true };
}

http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    if (req.url?.endsWith("/chat/completions")) {
      res.setHeader("content-type", "application/json");
      try { res.end(JSON.stringify(reply(answer(JSON.parse(b))))); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: { message: String(e) } })); }
    } else { res.statusCode = 404; res.end("{}"); }
  });
}).listen(4010, () => console.log("fake llm on 4010"));
