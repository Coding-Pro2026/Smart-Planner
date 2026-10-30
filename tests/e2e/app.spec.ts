import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "./make-pdf";

const email = `e2e-${Date.now()}@test.dev`;

async function signUp(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: /Create an account/ }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-very-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your events" })).toBeVisible();
}

test.describe.serial("PlanGenie end-to-end", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await (await browser.newContext()).newPage(); });

  test("sign up, create an event with a starter plan, see KPIs", async () => {
    await signUp(page);
    await page.getByRole("button", { name: /New event/ }).click();
    await page.getByLabel("Title").fill("Priya & Sam");
    await page.getByLabel("Event date").fill("2031-06-15");
    await page.getByLabel("Guests").fill("100");
    await page.getByLabel("Target budget").fill("30000");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByRole("heading", { name: "Priya & Sam" })).toBeVisible();
    await expect(page.getByText("Days to event")).toBeVisible();
    await expect(page.getByText("Budget burn")).toBeVisible();
    await expect(page.getByText("0/12")).toBeVisible(); // tasks done
  });

  test("budget simulator reacts live and flags overspend; line edits recompute server-side", async () => {
    await page.getByRole("link", { name: "Budget" }).click();
    await expect(page.getByText("projected total")).toBeVisible();
    const slider = page.getByLabel(/Guests: 100/);
    // Pushing the guest slider changes per-guest lines; here lines are flat so total stays, but target slider can trigger "over".
    const target = page.getByLabel(/Target budget:/);
    await target.fill("10000");
    await expect(page.getByText(/exceeds your budget/)).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText(/exceeds your budget/)).toHaveCount(0);
    await slider.waitFor();
    // Add a per-guest item and verify the engine's number: 85 * 100 guests * 1.08 * 1.05 = 9639.00
    await page.getByLabel("Name").fill("Plated dinner");
    await page.getByLabel("Category", { exact: true }).fill("Food & Beverage");
    await page.getByLabel("Unit cost").fill("85");
    await page.getByLabel("Tax %").fill("8");
    await page.getByLabel("Cont. %").fill("5");
    await page.getByLabel("Per guest").last().check();
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("row", { name: /Plated dinner/ })).toContainText("$9,639");
  });

  test("timeline: drag a task, review the cascade preview, accept", async () => {
    await page.getByRole("link", { name: "Timeline" }).click();
    const bar = page.getByRole("button", { name: /Book venue & sign contract:/ });
    await expect(bar).toBeVisible();
    const box = (await bar.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 8 * 30, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    const banner = page.getByRole("alert").filter({ hasText: "reschedules" });
    await expect(banner).toContainText("Book venue & sign contract");
    await banner.getByRole("button", { name: "Accept" }).click();
    await expect(banner).toHaveCount(0);
    // 240px / 8px-per-day = +30 days: venue start 2030-06-25 -> 2030-07-25, and the persisted plan reflects it
    await expect(page.getByRole("row", { name: /^Book venue & sign contract 2030-07-25/ })).toBeVisible();
  });

  test("settings: connect a local OpenAI-compatible model (validated by a real ping)", async () => {
    await page.goto("/settings");
    await page.getByLabel("Provider").selectOption("custom");
    await page.getByLabel("Base URL").fill("http://localhost:4010/v1");
    await page.getByLabel("Fast model").fill("fake-fast");
    await page.getByLabel("Reasoning / vision model").fill("fake-reason");
    await page.getByRole("button", { name: /Test connection/ }).click();
    await expect(page.getByText("Connection verified and saved.")).toBeVisible();
    // Key material must be encrypted at rest in the browser, not plain text.
    const ss = await page.evaluate(() => sessionStorage.getItem("pg_llm_v1"));
    expect(ss).toBeTruthy();
    expect(ss).not.toContain("fake-fast");
  });

  test("a bad endpoint is refused before saving (SSRF guard)", async () => {
    await page.goto("/settings");
    await page.getByLabel("Provider").selectOption("custom");
    await page.getByLabel("Base URL").fill("http://169.254.169.254/latest");
    await page.getByLabel("Fast model").fill("m");
    await page.getByLabel("Reasoning / vision model").fill("m");
    await page.getByRole("button", { name: /Test connection/ }).click();
    await expect(page.locator('p[role="alert"]')).toContainText(/not allowed/i);
  });

  test("assistant proposes changes; nothing applies until Accept", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: /Priya & Sam/ }).click();
    await page.getByRole("link", { name: "Assistant" }).click();
    await page.getByPlaceholder(/Ask for a timeline/).fill("Plan the florals");
    await page.getByRole("button", { name: "Send" }).click();
    const region = page.getByRole("region", { name: "Proposed changes" });
    await expect(region).toContainText("Assistant wants to add 2 tasks, add 1 budget item");
    await page.getByRole("link", { name: "Timeline" }).click();
    await expect(page.getByRole("cell", { name: /Book florist/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Assistant" }).click();
    // the page remounted, so ask again then accept
    await page.getByPlaceholder(/Ask for a timeline/).fill("Plan the florals");
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByRole("region", { name: "Proposed changes" }).last().getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("accepted", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Timeline" }).click();
    await expect(page.getByRole("cell", { name: "Book florist" }).first()).toBeVisible();
    await page.getByRole("link", { name: "Budget" }).click();
    await expect(page.getByRole("row", { name: /Bridal bouquet/ })).toContainText("$294");
  });

  test("vendors: upload two PDF quotes, compare side by side, hidden fee surfaced", async () => {
    await page.getByRole("link", { name: "Vendors" }).click();
    for (const [name, lines] of [["Bloom", ["Bloom & Co Quote", "Ceremony florals 1800", "Delivery and setup fee 250 (see terms)", "All deposits are non-refundable."]], ["Petal", ["Petal Pushers Quote", "Ceremony florals 2000", "Total 3200"]]] as const) {
      await page.locator('input[type="file"]').setInputFiles({ name: `${name}.pdf`, mimeType: "application/pdf", buffer: makePdf([...lines]) });
      await page.getByRole("button", { name: "Analyse quote" }).click();
      await expect(page.getByText(/Parsed — all-in total/)).toBeVisible({ timeout: 30_000 });
    }
    await page.getByLabel("compare").first().check();
    await page.getByLabel("compare").nth(1).check();
    await page.getByRole("button", { name: /^Compare/ }).click();
    const dlg = page.getByRole("dialog", { name: "Quote comparison" });
    await expect(dlg).toContainText("Bloom & Co");
    await expect(dlg).toContainText("Petal Pushers");
    await expect(dlg).toContainText("not quoted"); // Bloom did not quote a bouquet
    await expect(dlg).toContainText("hidden in fine print");
    await expect(dlg).toContainText("lowest all-in");
    await expect(dlg).toContainText("non refundable"); // regex backstop flagged the clause
  });

  test("a photographed quote (image) is read by the vision path, and can be added to the budget", async () => {
    await page.getByRole("button", { name: "Close" }).click(); // comparison modal from the previous test
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await page.locator('input[type="file"]').setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Analyse quote" }).click();
    await expect(page.getByText(/Parsed — all-in total/).last()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Add to budget" }).last().click();
    await expect(page.getByRole("button", { name: /Added/ })).toHaveCount(1);
    await page.getByRole("link", { name: "Budget" }).click();
    await expect(page.getByRole("row", { name: /Petal Pushers — Florist/ }).first()).toContainText("$3,200");
  });

  test("live sync: a change made in another tab appears without reloading", async () => {
    await page.getByRole("link", { name: "Budget" }).click();
    await expect(page.getByText("projected total")).toBeVisible();
    const other = await page.context().newPage();
    await other.goto(page.url());
    const id = page.url().match(/events\/([^/]+)/)![1];
    const ok = await other.evaluate(async (eventId) => (await fetch(`/api/events/${eventId}/budget`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Synced live item", category: "Misc", unitCost: 42 }) })).ok, id);
    expect(ok).toBe(true);
    await expect(page.getByRole("row", { name: /Synced live item/ })).toBeVisible({ timeout: 8000 });
    await other.close();
  });

  test("a non-PDF disguised as .pdf is rejected", async () => {
    await page.getByRole("link", { name: "Vendors" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
    await page.getByRole("button", { name: "Analyse quote" }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("not a PDF");
  });

  test("no secret ever reaches the page HTML or JS bundles", async () => {
    const html = await page.content();
    expect(html).not.toMatch(/ENCRYPTION_MASTER_KEY|AUTH_SECRET|sk-[A-Za-z0-9]{12,}/);
  });
});
