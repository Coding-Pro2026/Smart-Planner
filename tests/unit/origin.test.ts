import { describe, expect, it } from "vitest";
import { isAllowedRequestOrigin } from "@/lib/http";

const h = (o: Record<string, string>) => new Headers(o);

describe("CSRF origin check", () => {
  it("allows safe methods and header-less (non-browser) clients", () => {
    expect(isAllowedRequestOrigin(h({}), "GET")).toBe(true);
    expect(isAllowedRequestOrigin(h({ host: "localhost:3000" }), "POST")).toBe(true);
  });
  it("trusts browser same-origin even when a proxy rewrites Host (Codespaces, Gitpod, ngrok)", () => {
    expect(isAllowedRequestOrigin(h({ origin: "https://abc-3000.app.github.dev", host: "localhost:3000", "sec-fetch-site": "same-origin" }), "POST")).toBe(true);
  });
  it("matches Origin against Host or X-Forwarded-Host when Sec-Fetch-Site is absent", () => {
    expect(isAllowedRequestOrigin(h({ origin: "http://localhost:3000", host: "localhost:3000" }), "POST")).toBe(true);
    expect(isAllowedRequestOrigin(h({ origin: "https://app.example.com", host: "internal:3000", "x-forwarded-host": "app.example.com" }), "POST")).toBe(true);
  });
  it("blocks cross-site requests and mismatched origins", () => {
    expect(isAllowedRequestOrigin(h({ origin: "https://evil.example", host: "localhost:3000", "sec-fetch-site": "cross-site" }), "POST")).toBe(false);
    expect(isAllowedRequestOrigin(h({ origin: "https://evil.example", host: "localhost:3000" }), "POST")).toBe(false);
    expect(isAllowedRequestOrigin(h({ origin: "http://127.0.0.1:3000", host: "localhost:3000" }), "POST")).toBe(false);
    expect(isAllowedRequestOrigin(h({ origin: "not a url", host: "x" }), "POST")).toBe(false);
  });
  it("honours ALLOWED_ORIGINS, including for same-site requests", () => {
    expect(isAllowedRequestOrigin(h({ origin: "https://my.app", host: "internal", "sec-fetch-site": "same-site" }), "POST", "https://my.app/, https://other.app")).toBe(true);
    expect(isAllowedRequestOrigin(h({ origin: "https://nope.app", host: "internal", "sec-fetch-site": "same-site" }), "POST", "https://my.app")).toBe(false);
  });
});
