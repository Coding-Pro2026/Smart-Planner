import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch, type RequestInit } from "undici";
import { env } from "../env";

/**
 * SSRF defences for user-controlled URLs (custom OpenAI-compatible / Ollama base URLs).
 *  - scheme must be http(s); no credentials in the URL
 *  - every IP the hostname resolves to is validated AT CONNECT TIME (closes DNS-rebinding TOCTOU)
 *  - redirects are refused
 *  - loopback / private ranges are blocked unless ALLOW_PRIVATE_LLM_ENDPOINTS=true (local Ollama),
 *    and cloud-metadata / link-local ranges are blocked unconditionally.
 */

export class SsrfError extends Error {}

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}
const inCidr4 = (ip: string, base: string, bits: number) => {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((v4ToInt(ip) & mask) >>> 0) === ((v4ToInt(base) & mask) >>> 0);
};

/** Always blocked, even for local-dev mode. */
function isAlwaysBlocked(ip: string): boolean {
  if (net.isIPv4(ip)) return inCidr4(ip, "169.254.0.0", 16) || inCidr4(ip, "0.0.0.0", 8) || inCidr4(ip, "224.0.0.0", 3);
  const l = ip.toLowerCase();
  if (l.startsWith("::ffff:")) {
    const tail = l.slice(7);
    return net.isIPv4(tail) ? isAlwaysBlocked(tail) : false;
  }
  return l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb") || l === "::" || l.startsWith("ff");
}

function isPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return (
      inCidr4(ip, "10.0.0.0", 8) || inCidr4(ip, "172.16.0.0", 12) || inCidr4(ip, "192.168.0.0", 16) ||
      inCidr4(ip, "127.0.0.0", 8) || inCidr4(ip, "100.64.0.0", 10) || inCidr4(ip, "192.0.0.0", 24) || inCidr4(ip, "198.18.0.0", 15)
    );
  }
  const l = ip.toLowerCase();
  if (l.startsWith("::ffff:")) {
    const tail = l.slice(7);
    return net.isIPv4(tail) ? isPrivate(tail) : true;
  }
  return l === "::1" || l.startsWith("fc") || l.startsWith("fd");
}

export function isBlockedIp(ip: string, allowPrivate: boolean): boolean {
  if (!net.isIP(ip)) return true;
  if (isAlwaysBlocked(ip)) return true;
  return allowPrivate ? false : isPrivate(ip);
}

export function parseEndpoint(raw: string, allowPrivate = env.allowPrivateLlmEndpoints): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError("Invalid endpoint URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new SsrfError("Endpoint must be http(s)");
  if (u.username || u.password) throw new SsrfError("Credentials in the endpoint URL are not allowed");
  if (u.protocol === "http:" && !allowPrivate) throw new SsrfError("Plain http endpoints are only allowed in local-dev mode");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedIp(host, allowPrivate)) throw new SsrfError("Endpoint address is not allowed");
  return u;
}

function guardedAgent(allowPrivate: boolean): Agent {
  return new Agent({
    connect: {
      lookup(hostname, options, cb) {
        dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
          if (err) return cb(err, "", 4);
          const list = (addrs as dns.LookupAddress[]) ?? [];
          const ok = list.filter((a) => !isBlockedIp(a.address, allowPrivate));
          const first = ok[0];
          if (!first || ok.length !== list.length) return cb(new SsrfError("Endpoint resolves to a disallowed address"), "", 4);
          if (options.all) return (cb as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, ok);
          cb(null, first.address, first.family);
        });
      },
    },
  });
}

/** fetch() for user-supplied URLs. Never use plain fetch for these. */
export async function safeFetch(rawUrl: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const allowPrivate = env.allowPrivateLlmEndpoints;
  const url = parseEndpoint(rawUrl, allowPrivate);
  const { timeoutMs = 60_000, ...rest } = init;
  return undiciFetch(url, {
    ...rest,
    redirect: "error",
    dispatcher: guardedAgent(allowPrivate),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
