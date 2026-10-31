import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

/**
 * SSRF-safe outbound HTTP for user-supplied AI endpoints.
 * - https only (http only when private targets are explicitly allowed)
 * - every resolved address is checked AT CONNECT TIME (defeats DNS rebinding)
 * - private / loopback / link-local / metadata / reserved ranges are blocked
 * - no redirects, response size cap, hard timeout
 */

export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const [a, b, c] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224 // multicast + reserved + broadcast
    );
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    const mapped = lower.match(/^(?:::ffff:|::ffff:0:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    // ::ffff:7f00:1 style (hex-encoded mapped IPv4)
    const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(lower.split(':')[0] || '0', 16);
    return (
      (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
      (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
      (first & 0xff00) === 0xff00 || // multicast
      lower.startsWith('2001:db8') // documentation
    );
  }
  return true; // not an IP => treat as unsafe
}

export interface SafeRequestOptions {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  allowPrivate?: boolean;
  /** Abort the upstream request (e.g. when our own client disconnects). */
  signal?: AbortSignal;
}

export interface SafeResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
}

/** Validates a user-provided base URL (syntax only; the network check happens at connect time). */
export function validateEndpointUrl(raw: string, allowPrivate = false): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (u.username || u.password) throw new Error('URLs with embedded credentials are not allowed');
  if (u.protocol !== 'https:' && !(allowPrivate && u.protocol === 'http:')) {
    throw new Error('Endpoint must use https://');
  }
  if (u.hash) throw new Error('URL fragments are not allowed');
  return u;
}

export function safeRequest(urlStr: string, opts: SafeRequestOptions): Promise<SafeResponse> {
  const allowPrivate = Boolean(opts.allowPrivate);
  const maxBytes = opts.maxBytes ?? 4_000_000;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = validateEndpointUrl(urlStr, allowPrivate);
    } catch (err) {
      return reject(err);
    }
    // Literal IPs are checked up-front (lookup is not invoked for them).
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !allowPrivate && isPrivateIp(host)) {
      return reject(new Error('That endpoint address is not allowed (private or reserved network)'));
    }

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: host,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: opts.method,
        headers: { ...(opts.headers ?? {}), ...(opts.body ? { 'Content-Length': String(Buffer.byteLength(opts.body)) } : {}) },
        timeout: timeoutMs,
        // Resolve and vet EVERY address at connection time so a hostname cannot rebind to a private IP.
        lookup: (hostname, options, callback) => {
          dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
            if (err) return (callback as any)(err);
            const list = Array.isArray(addresses) ? addresses : [{ address: addresses as unknown as string, family: 4 }];
            if (!allowPrivate && list.some((a) => isPrivateIp(a.address))) {
              return (callback as any)(
                new Error('That endpoint address is not allowed (private or reserved network)')
              );
            }
            if ((options as any)?.all) return (callback as any)(null, list);
            return (callback as any)(null, list[0].address, list[0].family);
          });
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (c: Buffer) => {
          total += c.length;
          if (total > maxBytes) {
            req.destroy(new Error('Response too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') })
        );
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request to the AI provider timed out')));
    if (opts.signal) {
      if (opts.signal.aborted) req.destroy(new Error('Request cancelled'));
      else opts.signal.addEventListener('abort', () => req.destroy(new Error('Request cancelled')), { once: true });
    }
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
