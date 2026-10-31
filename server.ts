import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Type } from './src/lib/llm/schemaType';
import {
  decryptSecretEnvelope,
  encryptSecretEnvelope,
  redactSensitiveStrings,
  sanitizeUntrustedInput,
} from './src/lib/crypto';
import { runAllVerificationSuites } from './src/tests/runAuditSuite';
import {
  AgentName,
  CheapHotelTestRunResult,
  CustomEventModule,
  HotelRoomBlockRecord,
  LiveNearbyHotelDeal,
  MoodboardPalette,
  ParsedVendorTerms,
  ProposedToolAction,
} from './src/types/domain';
import {
  generateContextualCustomModules,
  generateDefaultHotelBlocks,
} from './src/lib/seedData';
import { parseIntake } from './src/lib/intakeParser';
import { buildLocalAssistantReply } from './src/lib/localAssistant';
import { generateIdeas, type IdeaCard, type IdeaSet } from './src/lib/ideas';
import { parseQuoteText } from './src/lib/quoteParser';
import { generateMoodboard } from './src/lib/moodboardGenerator';
import { isValidIsoDate } from './src/lib/dates';
import { safeHttpUrl } from './src/lib/url';
import { geocode, findHotelsNear } from './src/server/geo';
import { AiClient, createAiClient, listModels, resolveAiConfig, testConnection, validateAiConfig } from './src/server/aiClient';
import { extractJson, isProviderId, redactSecret } from './src/lib/llm/providers';
import { cleanTitle, sanitizeMoodboard, sanitizeOrchestratorOutput } from './src/lib/llm/sanitize';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let envCooldownUntil = 0;

/**
 * Resolves the AI client for THIS request: the user's own key (BYOK headers) first, otherwise an
 * optional server-side key from the environment, otherwise null => deterministic local engine.
 * An invalid BYOK config is a 400 (never silently ignored).
 */
function getAi(req: Request): AiClient | null {
  let resolved: ReturnType<typeof resolveAiConfig>;
  try {
    resolved = resolveAiConfig(req);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'Invalid AI configuration');
  }
  if (!resolved) return null;
  if (!resolved.userSupplied && Date.now() < envCooldownUntil) return null;
  return createAiClient(resolved.config, resolved.userSupplied);
}

/** Records an AI failure. Users who supplied their own key are told why we fell back. */
function noteAiFailure(context: string, err: unknown, ai: AiClient | null, res: Response): void {
  const msg = redactSensitiveStrings(err instanceof Error ? err.message : String(err));
  console.warn(`[ai] ${context} failed (${ai?.provider ?? 'n/a'}), using local engine: ${msg.slice(0, 160)}`);
  if (ai?.userSupplied) {
    if (!res.headersSent) {
      res.setHeader('X-AI-Fallback', msg.replace(/[^\x20-\x7e]/g, ' ').slice(0, 160));
    }
  } else if (/api key|permission|unauthor|quota|exhaust|429|403|401/i.test(msg)) {
    envCooldownUntil = Date.now() + 60_000;
  }
}

/** Runs a Gemini call with a hard timeout so a hung upstream never hangs a request. */
async function withTimeout<T>(p: Promise<T>, ms = 42_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Gemini request timed out')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Parses model JSON output, tolerating accidental code fences. */
function parseModelJson(text: string | undefined): any {
  return JSON.parse(extractJson(text ?? '{}') || '{}');
}

// Server-side encrypted routing vault store (keyed by tenantId)
const tenantEncryptedVault = new Map<string, string>();
// Seed initial encrypted routing configuration for primary tenant
tenantEncryptedVault.set(
  'usr_primary_01',
  encryptSecretEnvelope(
    JSON.stringify({
      fastTaskProfile: 'gemini-3.8-flash',
      reasoningVisionProfile: 'gemini-3.8-flash',
      encryptionMode: 'aes_256_gcm_vault',
      provisionedAt: new Date().toISOString(),
    }),
    'usr_primary_01'
  )
);

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  // Express 4 does not forward rejected promises from async handlers to the
  // error middleware; wrap them so a thrown error becomes a clean JSON 500.
  const wrapAsync =
    (fn: any) =>
    (req: Request, res: Response, next: express.NextFunction) => {
      try {
        const out = fn(req, res, next);
        if (out && typeof out.catch === 'function') out.catch(next);
      } catch (err) {
        next(err);
      }
    };
  const originalPost = app.post.bind(app) as (path: string, ...h: any[]) => unknown;
  (app as any).post = (path: string, ...handlers: any[]) =>
    originalPost(path, ...handlers.map(wrapAsync));

  // Behind a reverse proxy / load balancer, set TRUST_PROXY=1 so req.ip (rate limiting) is the client IP.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
  }

  const isProd = process.env.NODE_ENV === 'production';

  // Security headers. The CSP only allows the third-party origins the UI actually uses.
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://maps.googleapis.com https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https://assets.mixkit.co",
    "connect-src 'self' https://maps.googleapis.com https://www.googleapis.com https://accounts.google.com",
    "frame-src https://www.openstreetmap.org https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    // allow-popups: required for Google sign-in popups to message back
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (isProd) {
      // CSP is enforced in production only: the Vite dev server injects inline scripts for HMR.
      res.setHeader('Content-Security-Policy', csp);
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  // Small JSON bodies everywhere; only the moodboard endpoint accepts an image (<= 5 MB file ≈ 7 MB base64).
  app.use('/api/agents/analyze-moodboard', express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '256kb' }));

  // Tiny in-memory rate limiter for the AI endpoints (per IP, per minute).
  const hits = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN) || 90;
  app.use('/api', (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const entry = hits.get(ip);
    if (!entry || entry.resetAt < now) {
      hits.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    entry.count += 1;
    if (entry.count > RATE_LIMIT) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests — please slow down for a moment.' });
    }
    next();
  });
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  }, 60_000).unref();

  // Tenant context. There is no authentication layer, so a client-supplied tenant header must NOT be
  // trusted by default (it would let any caller read/write another tenant's vault entry). It is only
  // honoured when an upstream gateway that authenticates users sets it and TRUST_TENANT_HEADER=true.
  const TRUST_TENANT_HEADER = process.env.TRUST_TENANT_HEADER === 'true';
  const getTenantId = (req: Request): string => {
    const headerTenant = req.headers['x-tenant-user-id'];
    return TRUST_TENANT_HEADER &&
      typeof headerTenant === 'string' &&
      /^[A-Za-z0-9_-]{1,64}$/.test(headerTenant.trim())
      ? headerTenant.trim()
      : 'usr_primary_01';
  };

  // Liveness / capability probe (never exposes secrets)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      time: new Date().toISOString(),
      // Users bring their own key (BYOK) per request; this only reports an optional server-side default.
      byok: true,
      serverDefaultAi: (() => {
        try {
          const r = resolveAiConfig({ headers: {} } as Request);
          return r ? `${r.config.provider}:${r.config.model}` : null;
        } catch {
          return null;
        }
      })(),
    });
  });

  // 1. Health & Vault Status Endpoint (Zero Secret Exposure)
  app.get('/api/vault/status', (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const envelope = tenantEncryptedVault.get(tenantId);
    let routingConfig = {
      fastTaskProfile: 'gemini-3.8-flash',
      reasoningVisionProfile: 'gemini-3.8-flash',
      encryptionMode: 'aes_256_gcm_vault',
    };

    if (envelope) {
      try {
        const decrypted = decryptSecretEnvelope(envelope, tenantId);
        routingConfig = JSON.parse(decrypted);
      } catch {
        // Ignore decryption failure and return defaults
      }
    }

    res.json({
      tenantId,
      cipherSuite: 'AES-256-GCM (12B IV, 16B AuthTag, HKDF-SHA256)',
      hasEncryptedEnvelope: Boolean(envelope),
      envelopePreview: envelope ? 'aes-256-gcm:v1:••••••••' : null,
      serverGeminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.AI_API_KEY),
      routingConfig,
    });
  });

  // 3. Automated Post-Production Security & Unit Verification Endpoint
  app.get('/api/security/audit', (_req: Request, res: Response) => {
    const report = runAllVerificationSuites();
    res.json(report);
  });

  // 4. Multi-Agent Planning Orchestrator (Supervisor + 4 Sub-Agents)
  app.post('/api/agents/orchestrate', async (req: Request, res: Response) => {
    const {
      prompt,
      eventContext,
      budgetSummary,
      tasksSummary,
      vendorsSummary,
    } = req.body ?? {};

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Please type a request for the assistant.' });
    }
    const sanitization = sanitizeUntrustedInput(prompt.slice(0, 2000));
    const cleanPrompt = sanitization.sanitizedText;
    const checkpointId = `ckpt_${Date.now().toString(36)}`;

    const ai = getAi(req);
    if (ai) {
      try {
        const modelToUse = ai.model;

        const response = await withTimeout(ai.models.generateContent({
          model: modelToUse,
          contents: `User Request: "${cleanPrompt}"
Event Context: ${JSON.stringify(eventContext ?? {})}
Current Budget Summary: ${JSON.stringify(budgetSummary ?? {})}
Current Tasks (DAG): ${JSON.stringify(tasksSummary ?? [])}
Current Vendors: ${JSON.stringify(vendorsSummary ?? [])}`,
          config: {
            systemInstruction: `You are the Supervisor Agent of PlanGenie, an enterprise multi-agent event planning orchestrator.
Coordinate four specialized sub-agents:
1. "Theme & Ideation Agent"
2. "Budget Allocator Agent"
3. "Logistics & Timeline Agent"
4. "Vendor & Contract Agent"

IMPORTANT ARCHITECTURE RULE:
- Never hallucinate final budget totals or dates yourself; instead emit structured tool proposals in "proposed_actions" so the deterministic engine can execute them after user confirmation.
- Available tool_name values:
  - "add_budget_item": payload must include { category: string, name: string, unit_cost: number, quantity: number, tax_pct: number, contingency_pct: number, is_per_guest: boolean }
  - "create_task": payload must include { title: string, category: string, milestone_code: string, duration_days: number, buffer_days: number, assigned_to: string, dependencies: string[] }
  - "shift_schedule": payload must include { target_task_id: string, task_title: string, delta_days: number }
  - "compare_vendor_quotes": payload must include { recommendation: string }
- Always provide 1 to 3 concrete, helpful proposed_actions matching the user's request.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                sender_agent: { type: Type.STRING },
                delegated_agents: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                reply_markdown: { type: Type.STRING },
                proposed_actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      tool_name: { type: Type.STRING },
                      agent: { type: Type.STRING },
                      summary: { type: Type.STRING },
                      category: { type: Type.STRING },
                      name: { type: Type.STRING },
                      unit_cost: { type: Type.NUMBER },
                      quantity: { type: Type.NUMBER },
                      tax_pct: { type: Type.NUMBER },
                      contingency_pct: { type: Type.NUMBER },
                      is_per_guest: { type: Type.BOOLEAN },
                      title: { type: Type.STRING },
                      milestone_code: { type: Type.STRING },
                      duration_days: { type: Type.NUMBER },
                      buffer_days: { type: Type.NUMBER },
                      assigned_to: { type: Type.STRING },
                      target_task_id: { type: Type.STRING },
                      delta_days: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
          },
        }));

        const parsed = parseModelJson(response.text);
        const clean = sanitizeOrchestratorOutput(parsed);
        const actions: ProposedToolAction[] = clean.actions.map((act, idx) => ({
          id: `act_${Date.now()}_${idx}`,
          ...act,
        }));

        res.json({
          sender_agent: clean.sender_agent,
          delegated_agents: clean.delegated_agents,
          content: redactSensitiveStrings(clean.reply),
          checkpoint_id: checkpointId,
          sanitizationWarnings: sanitization.warnings,
          proposed_actions: actions,
          engine: ai.provider,
        });
        return;
      } catch (err) {
        noteAiFailure('orchestrate', err, ai, res);
        // Fall through to deterministic multi-agent synthesis if quota/network error occurs
      }
    }

    // Deterministic fallback: prompt-aware local assistant (no key / quota / network failure)
    const local = buildLocalAssistantReply(cleanPrompt, {
      eventContext,
      budgetSummary,
      tasksSummary: Array.isArray(tasksSummary) ? tasksSummary : [],
      vendorsSummary: Array.isArray(vendorsSummary) ? vendorsSummary : [],
    });
    res.json({
      sender_agent: local.sender_agent,
      delegated_agents: local.delegated_agents,
      content: local.content,
      checkpoint_id: checkpointId,
      sanitizationWarnings: sanitization.warnings,
      proposed_actions: local.proposed_actions,
      engine: 'local',
    });
  });

  // 5. Vendor Quote OCR & Contract Risk Extraction Agent
  app.post('/api/agents/parse-quote', async (req: Request, res: Response) => {
    const { vendorName, serviceType, rawQuoteText, filename } = req.body ?? {};
    if (typeof rawQuoteText !== 'string' || rawQuoteText.trim().length < 5) {
      return res.status(400).json({ error: 'Paste the quote text to analyse.' });
    }
    const sanitized = sanitizeUntrustedInput(rawQuoteText.slice(0, 20_000));

    const ai = getAi(req);
    if (ai && sanitized.sanitizedText.trim().length > 10) {
      try {
        const response = await withTimeout(ai.models.generateContent({
          model: ai.model,
          contents: `Extract structured financial and legal risk terms from this vendor quote:
Vendor: ${vendorName || 'Prospective Vendor'}
Service: ${serviceType || 'Event Services'}
Document Text:
${sanitized.sanitizedText}`,
          config: {
            systemInstruction:
              'You are the Vendor & Contract Agent. Extract base fee, service charge %, gratuity %, tax %, true total cost, payment schedule, cancellation policy, hidden fees, risk clauses, and line items.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                base_fee: { type: Type.NUMBER },
                service_charge_pct: { type: Type.NUMBER },
                gratuity_pct: { type: Type.NUMBER },
                tax_pct: { type: Type.NUMBER },
                payment_schedule: { type: Type.ARRAY, items: { type: Type.STRING } },
                cancellation_policy: { type: Type.STRING },
                hidden_fees_detected: { type: Type.ARRAY, items: { type: Type.STRING } },
                risk_clauses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      clause: { type: Type.STRING },
                      severity: { type: Type.STRING },
                      recommendation: { type: Type.STRING },
                    },
                  },
                },
                line_items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING },
                      amount: { type: Type.NUMBER },
                      included: { type: Type.BOOLEAN },
                    },
                  },
                },
              },
            },
          },
        }));

        const parsed = parseModelJson(response.text);
        // Local parse is the factual baseline; Gemini fills in what it found reliably.
        const local = parseQuoteText(sanitized.sanitizedText, {
          serviceType: typeof serviceType === 'string' ? serviceType : undefined,
        });
        const num = (v: unknown, fallback: number) =>
          Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback;
        const base = num(parsed.base_fee, local.base_fee);
        if (base <= 0) throw new Error('model returned no base fee');
        const svcPct = num(parsed.service_charge_pct, local.service_charge_pct);
        const gratPct = num(parsed.gratuity_pct, local.gratuity_pct);
        const taxPct = num(parsed.tax_pct, local.tax_pct);
        const flat = local.line_items
          .filter((l) => !l.included && !/\(\d+(\.\d+)?%\)/.test(l.description))
          .reduce((sum, l) => sum + l.amount, 0);
        const deterministicTrueCost =
          Math.round((base * (1 + (svcPct + gratPct + taxPct) / 100) + flat) * 100) / 100;
        const strList = (v: unknown, fb: string[]) =>
          Array.isArray(v) && v.length > 0 ? v.map((x) => String(x).slice(0, 240)) : fb;

        const terms: ParsedVendorTerms = {
          base_fee: base,
          service_charge_pct: svcPct,
          gratuity_pct: gratPct,
          tax_pct: taxPct,
          total_true_cost: deterministicTrueCost,
          payment_schedule: strList(parsed.payment_schedule, local.payment_schedule),
          cancellation_policy: String(parsed.cancellation_policy || local.cancellation_policy).slice(0, 300),
          hidden_fees_detected: strList(parsed.hidden_fees_detected, local.hidden_fees_detected),
          risk_clauses:
            Array.isArray(parsed.risk_clauses) && parsed.risk_clauses.length > 0
              ? parsed.risk_clauses.slice(0, 10).map((r: any) => ({
                  clause: String(r?.clause ?? 'Review clause').slice(0, 200),
                  severity: ['low', 'medium', 'high'].includes(r?.severity) ? r.severity : 'medium',
                  recommendation: String(r?.recommendation ?? '').slice(0, 240),
                }))
              : local.risk_clauses,
          line_items:
            Array.isArray(parsed.line_items) && parsed.line_items.length > 0
              ? parsed.line_items.slice(0, 20).map((l: any) => ({
                  description: String(l?.description ?? 'Item').slice(0, 120),
                  amount: num(l?.amount, 0),
                  included: Boolean(l?.included),
                }))
              : local.line_items,
        };

        res.json({
          vendorName: String(vendorName || 'Prospective Vendor').slice(0, 80),
          serviceType: String(serviceType || 'Event Services').slice(0, 60),
          filename: String(filename || 'Pasted_Vendor_Quote.txt').slice(0, 120),
          parsed_terms: terms,
          sanitizationWarnings: sanitized.warnings,
        });
        return;
      } catch (err) {
        noteAiFailure('parse-quote', err, ai, res);
        // Fall through to deterministic parser
      }
    }

    // Deterministic parser: reads the real numbers and clauses from the pasted text
    const fallbackTerms: ParsedVendorTerms = parseQuoteText(sanitized.sanitizedText, {
      serviceType: typeof serviceType === 'string' ? serviceType : undefined,
    });
    if (fallbackTerms.base_fee <= 0) {
      return res.status(422).json({
        error:
          'I couldn’t find any prices in that text. Paste the quote including dollar amounts (e.g. “Package: $5,000, service charge 20%”).',
      });
    }

    res.json({
      vendorName: String(vendorName || 'Prospective Vendor').slice(0, 80),
      serviceType: String(serviceType || 'Event Services').slice(0, 60),
      filename: String(filename || 'Pasted_Vendor_Quote.txt').slice(0, 120),
      parsed_terms: fallbackTerms,
      sanitizationWarnings: sanitized.warnings,
      engine: 'local',
    });
  });

  // 6. Multimodal Moodboard & Theme Ideation Agent
  app.post('/api/agents/analyze-moodboard', async (req: Request, res: Response) => {
    const { prompt, imageBase64, mimeType, eventId } = req.body ?? {};
    const cleanPrompt = sanitizeUntrustedInput(String(prompt ?? '')).sanitizedText;

    const ai = getAi(req);
    if (ai) {
      try {
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
        if (imageBase64 && typeof imageBase64 === 'string') {
          const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
          const dataUrlMime = imageBase64.match(/^data:(image\/[a-z+.-]+);base64,/i)?.[1];
          const mime = String(dataUrlMime || mimeType || 'image/jpeg').toLowerCase();
          // Only real image types and plain base64 are forwarded to the provider.
          if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime) && /^[A-Za-z0-9+/=\s]+$/.test(base64Data)) {
            parts.push({ inlineData: { mimeType: mime, data: base64Data.replace(/\s+/g, '') } });
          }
        }
        parts.push({
          text: `Decompose this event mood board / creative direction into a structured luxury event design palette. Creative brief: "${cleanPrompt}"`,
        });

        const response = await withTimeout(ai.models.generateContent({
          model: ai.model,
          contents: { parts },
          config: {
            systemInstruction:
              'You are the Theme & Ideation Agent. Extract 5 distinct hex color swatches with names and usage, style archetype, decor elements, lighting atmosphere, floral notes, and culinary/dietary suggestions.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                style_archetype: { type: Type.STRING },
                color_Swatches: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      hex: { type: Type.STRING },
                      name: { type: Type.STRING },
                      usage: { type: Type.STRING },
                    },
                  },
                },
                decor_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
                lighting_atmosphere: { type: Type.STRING },
                floral_botanical_notes: { type: Type.ARRAY, items: { type: Type.STRING } },
                culinary_dietary_pairings: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
        }));

        const parsed = parseModelJson(response.text);
        // Small models often return malformed swatches/titles: validate, else use the local generator.
        const palette: MoodboardPalette =
          sanitizeMoodboard(parsed, String(eventId || 'evt_unknown')) ?? {
            ...generateMoodboard({ prompt: cleanPrompt, eventId: String(eventId || 'evt_unknown') }),
            // keep a usable model-written title even when the palette itself was unusable
            ...(typeof parsed?.title === 'string' && cleanTitle(parsed.title, '', 70) ? { title: cleanTitle(parsed.title, '', 70) } : {}),
          };

        res.json(palette);
        return;
      } catch (err) {
        noteAiFailure('analyze-moodboard', err, ai, res);
        // Fall through to deterministic moodboard decomposition
      }
    }

    const fallbackPalette: MoodboardPalette = generateMoodboard({
      prompt: cleanPrompt,
      eventId: String(eventId || 'evt_unknown'),
      eventType: typeof req.body?.eventType === 'string' ? req.body.eventType : undefined,
    });

    res.json(fallbackPalette);
  });

  // 7. Dynamic Event-Type & Location Custom Category + Destination Hotel Block Generator (Chain-of-Thought Reasoning)
  app.post('/api/agents/generate-custom-modules', async (req: Request, res: Response) => {
    const {
      eventId = 'evt_wedding_01',
      eventType = 'wedding',
      location = 'Napa Valley, CA',
      eventDate = '2027-05-15',
      eventDays = 2,
      isDestination = true,
      customPrompt = '',
    } = req.body ?? {};

    const cleanType = sanitizeUntrustedInput(String(eventType)).sanitizedText;
    const cleanLocation = sanitizeUntrustedInput(String(location)).sanitizedText;
    const cleanCustomPrompt = sanitizeUntrustedInput(String(customPrompt)).sanitizedText;
    const parsedDays = Math.max(1, Math.min(14, Number(eventDays) || 1));

    // Deterministic Chain-of-Thought baseline analysis
    const lowerCombined = `${cleanType} ${cleanLocation} ${cleanCustomPrompt}`.toLowerCase();
    const isFuneral =
      lowerCombined.includes('funeral') ||
      lowerCombined.includes('memorial') ||
      lowerCombined.includes('celebration of life') ||
      lowerCombined.includes('eulogy') ||
      lowerCombined.includes('bereavement');
    const isIndianWedding =
      lowerCombined.includes('india') ||
      lowerCombined.includes('udaipur') ||
      lowerCombined.includes('jaipur') ||
      lowerCombined.includes('mumbai') ||
      lowerCombined.includes('delhi') ||
      lowerCombined.includes('sangeet') ||
      lowerCombined.includes('haldi') ||
      lowerCombined.includes('mehendi') ||
      (cleanType.toLowerCase().includes('wedding') && parsedDays >= 4);

    const defaultCotAnalysis = isFuneral
      ? {
          step_1_event_archetype_analysis: `Event identified as a solemn Funeral / Celebration of Life (${parsedDays} day(s)). Requires dignified bereavement protocol, clear family processional coordination, and zero-friction hospitality for grieving relatives.`,
          step_2_regional_and_cultural_nuances: `Located in ${cleanLocation}. Must coordinate sanctuary/chapel acoustic timing, floral tribute placement, printed order-of-service booklets, and post-service repast reception.`,
          step_3_speaking_and_ritual_sequence: `Critical speaking sequence ("Who Speaks First"): #1 Officiant invocation -> #2 Eldest child / primary family eulogy -> #3 Sibling & grandchild tributes -> #4 Colleague/friend remembrance -> #5 Committal & pallbearer recessional.`,
          step_4_sub_category_mapping: `Synthesizing 3 nuanced sub-categories: (1) Eulogy & Speaking Order (Who Speaks First), (2) Pallbearers, Processional & Sanctuary Rituals, and (3) Bereavement Repast & Family Hospitality.`,
        }
      : isIndianWedding
      ? {
          step_1_event_archetype_analysis: `Event identified as a multi-day (${parsedDays}-Day) Indian Destination Wedding. Requires high-touch hospitality, distinct venue transformations per ceremony, and coordinated guest transport.`,
          step_2_regional_and_cultural_nuances: `Located in ${cleanLocation}. Traditional sequence spans Ganesh Puja welcome, Haldi, Mehendi, Sangeet night, Baraat procession, sacred Pheras under the Mandap, and Grand Reception.`,
          step_3_speaking_and_ritual_sequence: `Critical ritual & speaking sequence: Day-by-day muhurat timing for ceremonies, plus ordered Sangeet family performances and reception toast order ("Who Speaks First").`,
          step_4_sub_category_mapping: `Synthesizing nuanced sub-categories: (1) ${parsedDays}-Day Indian Wedding Ceremony & Ritual Checklist, and (2) Sangeet Performances & Family Toast Speaking Order (Who Goes First).`,
        }
      : {
          step_1_event_archetype_analysis: `Event identified as a ${parsedDays}-day ${cleanType} in ${cleanLocation}. Requires structured run-of-show timing, clear speaker sequencing, and coordinated guest accommodations.`,
          step_2_regional_and_cultural_nuances: `Tailored to ${cleanLocation} regional venue logistics, local acoustic curfews, and out-of-town guest shuttle turnarounds.`,
          step_3_speaking_and_ritual_sequence: `Critical speaking sequence ("Who Speaks First"): Welcome remarks -> Primary family/keynote address -> Featured toasts -> Closing gratitude & transition.`,
          step_4_sub_category_mapping: `Synthesizing nuanced sub-categories: (1) Speaking & Toast Order (Who Speaks First), and (2) ${parsedDays}-Day Regional Run-of-Show & Ritual Checklist.`,
        };

    const ai = getAi(req);
    if (ai) {
      try {
        const response = await withTimeout(ai.models.generateContent({
          model: ai.model,
          contents: `Use explicit Chain-of-Thought (CoT) reasoning to analyze this event and build specific, nuanced sub-categories and ritual checklists BEFORE returning the final modules:
- Event Type: "${cleanType}"
- Location / Region: "${cleanLocation}"
- Event Duration: ${parsedDays} day(s)
- Destination Event: ${Boolean(isDestination)}
- Additional Organizer Notes: "${cleanCustomPrompt}"

CHAIN-OF-THOUGHT INSTRUCTIONS (Complete "chain_of_thought_analysis" FIRST):
1. step_1_event_archetype_analysis: Explicitly analyze the event type ("${cleanType}"), its emotional tone, formality level, and core operational requirements (e.g., solemn funeral/memorial bereavement vs. multi-day Indian wedding vs. Western wedding vs. milestone gala).
2. step_2_regional_and_cultural_nuances: Analyze how the location ("${cleanLocation}") and duration (${parsedDays} days) shape the customs, rituals, and guest hospitality needs.
3. step_3_speaking_and_ritual_sequence: Determine the exact chronological speaking order ("Who Speaks First" — eulogies, family tributes, toasts, keynotes) and ritual progression (e.g., Pallbearers & Committal for a funeral; Ganesh Puja, Haldi, Mehendi, Sangeet, Baraat, Pheras for an Indian wedding; Rehearsal, Ceremony Processional, Reception Toasts for a Western wedding).
4. step_4_sub_category_mapping: Based on Steps 1-3, design 2 to 3 specific, nuanced sub-category modules with 4-7 detailed checklist items each, plus suggested budget items, schedule tasks, and 2 nearby hotel room blocks in ${cleanLocation}.`,
          config: {
            systemInstruction:
              'You are an Agentic Cultural & Regional Event Architect. Always perform explicit 4-step Chain-of-Thought analysis first to deduce event-specific rituals, speaking order (who speaks first), and sub-categories before generating the structured modules and hotel blocks.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                chain_of_thought_analysis: {
                  type: Type.OBJECT,
                  properties: {
                    step_1_event_archetype_analysis: { type: Type.STRING },
                    step_2_regional_and_cultural_nuances: { type: Type.STRING },
                    step_3_speaking_and_ritual_sequence: { type: Type.STRING },
                    step_4_sub_category_mapping: { type: Type.STRING },
                  },
                },
                modules: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category_title: { type: Type.STRING },
                      module_type: { type: Type.STRING },
                      description: { type: Type.STRING },
                      location_context: { type: Type.STRING },
                      items: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            order_index: { type: Type.NUMBER },
                            title: { type: Type.STRING },
                            role_or_day: { type: Type.STRING },
                            person_or_lead: { type: Type.STRING },
                            notes: { type: Type.STRING },
                          },
                        },
                      },
                      suggested_budget_additions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            category: { type: Type.STRING },
                            name: { type: Type.STRING },
                            unit_cost: { type: Type.NUMBER },
                            quantity: { type: Type.NUMBER },
                            is_per_guest: { type: Type.BOOLEAN },
                          },
                        },
                      },
                      suggested_task_additions: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            title: { type: Type.STRING },
                            category: { type: Type.STRING },
                            milestone_code: { type: Type.STRING },
                            duration_days: { type: Type.NUMBER },
                          },
                        },
                      },
                    },
                  },
                },
                hotel_blocks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      hotel_name: { type: Type.STRING },
                      room_type: { type: Type.STRING },
                      nights: { type: Type.NUMBER },
                      rooms_blocked: { type: Type.NUMBER },
                      rooms_booked: { type: Type.NUMBER },
                      nightly_rate: { type: Type.NUMBER },
                      group_code: { type: Type.STRING },
                      shuttle_included: { type: Type.BOOLEAN },
                      assigned_guests_notes: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        }));

        const parsed = parseModelJson(response.text);
        if (Array.isArray(parsed.modules) && parsed.modules.length > 0) {
          const builtModules: CustomEventModule[] = parsed.modules.map(
            (m: any, idx: number) => ({
              id: `cmod_ai_${Date.now()}_${idx}`,
              event_id: eventId,
              category_title: String(m.category_title || 'Custom Event Category'),
              module_type:
                m.module_type === 'speaking_order' ||
                m.module_type === 'multi_day_itinerary' ||
                m.module_type === 'cultural_rituals' ||
                m.module_type === 'hotel_accommodation'
                  ? m.module_type
                  : 'custom_checklist',
              description: String(m.description || ''),
              location_context: String(
                m.location_context || `${cleanLocation} · ${parsedDays}-Day Format`
              ),
              items: Array.isArray(m.items)
                ? m.items.map((it: any, iIdx: number) => ({
                    id: `citem_ai_${Date.now()}_${idx}_${iIdx}`,
                    order_index: Number(it.order_index) || iIdx + 1,
                    title: String(it.title || 'Custom Step'),
                    role_or_day: String(it.role_or_day || `Step #${iIdx + 1}`),
                    person_or_lead: String(it.person_or_lead || 'Lead Coordinator'),
                    notes: String(it.notes || ''),
                    completed: false,
                  }))
                : [],
              suggested_budget_additions: Array.isArray(m.suggested_budget_additions)
                ? m.suggested_budget_additions
                : [],
              suggested_task_additions: Array.isArray(m.suggested_task_additions)
                ? m.suggested_task_additions
                : [],
            })
          );

          const builtHotels: HotelRoomBlockRecord[] =
            Array.isArray(parsed.hotel_blocks) && parsed.hotel_blocks.length > 0
              ? parsed.hotel_blocks.map((hb: any, hIdx: number) => ({
                  id: `htl_ai_${Date.now()}_${hIdx}`,
                  event_id: eventId,
                  hotel_name: String(hb.hotel_name || `${cleanLocation} Grand Hotel`),
                  room_type: String(hb.room_type || 'Deluxe Group Room Block'),
                  check_in_date: eventDate,
                  check_out_date: eventDate,
                  nights: Math.max(1, Number(hb.nights) || parsedDays),
                  rooms_blocked: Math.max(5, Number(hb.rooms_blocked) || 25),
                  rooms_booked: Math.max(1, Number(hb.rooms_booked) || 15),
                  nightly_rate: Math.max(50, Number(hb.nightly_rate) || 195),
                  group_code: String(hb.group_code || 'EVENT-VIP'),
                  shuttle_included: Boolean(hb.shuttle_included ?? true),
                  assigned_guests_notes: String(
                    hb.assigned_guests_notes ||
                      'Out-of-town guests & family block with venue shuttle.'
                  ),
                  booking_status: 'contracted',
                }))
              : generateDefaultHotelBlocks({
                  eventId,
                  eventType: cleanType,
                  location: cleanLocation,
                  eventDate,
                  eventDays: parsedDays,
                });

          res.json({
            chainOfThoughtAnalysis: parsed.chain_of_thought_analysis || defaultCotAnalysis,
            modules: builtModules,
            hotelBlocks: builtHotels,
          });
          return;
        }
      } catch (err) {
        noteAiFailure('generate-custom-modules', err, ai, res);
        // Fall through to deterministic cultural/location generator
      }
    }

    const fallbackModules = generateContextualCustomModules({
      eventId,
      eventType: cleanType,
      location: cleanLocation,
      eventDays: parsedDays,
      customNotes: cleanCustomPrompt,
    });
    const fallbackHotels = generateDefaultHotelBlocks({
      eventId,
      eventType: cleanType,
      location: cleanLocation,
      eventDate,
      eventDays: parsedDays,
    });

    res.json({
      chainOfThoughtAnalysis: defaultCotAnalysis,
      modules: fallbackModules,
      hotelBlocks: fallbackHotels,
    });
  });

  // 7B. Conversational "Plan with AI" Onboarding Intake Agent
  app.post('/api/agents/ai-intake-chat', async (req: Request, res: Response) => {
    const {
      message = '',
      conversationHistory = [],
      currentDraft = {},
    } = req.body ?? {};

    const cleanMessage = sanitizeUntrustedInput(String(message)).sanitizedText;
    const tempEventId = String(currentDraft.id || `evt_ai_${Date.now()}`);
    const lower = cleanMessage.toLowerCase();

    // Deterministic extraction as the baseline before / instead of the LLM
    const parsedIntake = parseIntake(cleanMessage, currentDraft);
    const detectedType = parsedIntake.event_type;
    const detectedLocation = parsedIntake.location;
    const detectedDays = parsedIntake.event_days;
    const detectedGuests = parsedIntake.guest_count;
    const detectedBudget = parsedIntake.target_budget;
    const detectedTitle = parsedIntake.title;
    const detectedDate = parsedIntake.date;

    const ai = getAi(req);
    if (ai) {
      try {
        const historyText = Array.isArray(conversationHistory)
          ? conversationHistory
              .slice(-6)
              .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
              .join('\n')
          : '';

        const response = await withTimeout(ai.models.generateContent({
          model: ai.model,
          contents: `Conversation History:
${historyText}
Latest User Message: "${cleanMessage}"
Current Draft State: ${JSON.stringify({
            title: detectedTitle,
            event_type: detectedType,
            location: detectedLocation,
            event_days: detectedDays,
            guest_count: detectedGuests,
            target_budget: detectedBudget,
            date: detectedDate,
          })}

Instructions:
1. Extract and refine the event details from the user's message (title, event_type, location, event_days, guest_count, target_budget, date).
2. Improvise 2 to 3 highly tailored custom event tabs (modules) specific to this event type and location:
   - For a Funeral / Memorial: MUST include "Eulogy & Speaking Order (Who Speaks First)" and "Pallbearers, Processional & Memorial Service" plus "Bereavement Reception & Repast".
   - For an Indian Wedding (e.g. 5 days): MUST include "5-Day Indian Wedding Ceremony & Ritual Schedule (Haldi, Mehendi, Sangeet, Baraat, Pheras)" and "Sangeet & Family Toast Speaking Order (Who Speaks First)".
   - For a USA/Western Wedding (1-2 days): MUST include "Wedding Weekend Run-of-Show" and "Reception Toasts & Speaking Order (Who Speaks First)".
   - For any other custom event: improvise custom tabs matching the user's exact request.
3. Improvise 2 affordable nearby hotel room blocks in ${detectedLocation}.
4. Write a warm, concise assistant reply explaining the custom tabs, speaking order/schedule, budget, and nearby cheap hotel blocks you have prepared, and invite them to click "Enter Workspace with Custom Tabs" or share any tweaks.`,
          config: {
            systemInstruction:
              'You are PlanGenie AI Event Architect. You converse with the user to gather their event details and dynamically improvise event-specific custom tabs, speaking order, multi-day regional schedules, and nearby hotel blocks.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                assistant_reply: { type: Type.STRING },
                event_draft: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    event_type: { type: Type.STRING },
                    location: { type: Type.STRING },
                    event_days: { type: Type.NUMBER },
                    guest_count: { type: Type.NUMBER },
                    target_budget: { type: Type.NUMBER },
                    date: { type: Type.STRING },
                  },
                },
                modules: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category_title: { type: Type.STRING },
                      module_type: { type: Type.STRING },
                      description: { type: Type.STRING },
                      location_context: { type: Type.STRING },
                      items: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            order_index: { type: Type.NUMBER },
                            title: { type: Type.STRING },
                            role_or_day: { type: Type.STRING },
                            person_or_lead: { type: Type.STRING },
                            notes: { type: Type.STRING },
                          },
                        },
                      },
                    },
                  },
                },
                hotel_blocks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      hotel_name: { type: Type.STRING },
                      room_type: { type: Type.STRING },
                      nights: { type: Type.NUMBER },
                      rooms_blocked: { type: Type.NUMBER },
                      rooms_booked: { type: Type.NUMBER },
                      nightly_rate: { type: Type.NUMBER },
                      group_code: { type: Type.STRING },
                      shuttle_included: { type: Type.BOOLEAN },
                      assigned_guests_notes: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        }));

        const parsed = parseModelJson(response.text);
        const draft = parsed.event_draft || {};
        const finalTitle = cleanTitle(draft.title, detectedTitle, 80);
        const finalType = String(draft.event_type || detectedType).toLowerCase();
        const finalLocation = String(draft.location || detectedLocation);
        const finalDays = Math.max(1, Math.min(14, Number(draft.event_days) || detectedDays));
        const finalGuests = Math.min(50_000, Math.max(1, Math.round(Number(draft.guest_count)) || detectedGuests));
        const finalBudget = Math.max(500, Number(draft.target_budget) || detectedBudget);
        const finalDate = isValidIsoDate(draft.date) ? String(draft.date) : detectedDate;

        const builtModules: CustomEventModule[] =
          Array.isArray(parsed.modules) && parsed.modules.length > 0
            ? parsed.modules.map((m: any, idx: number) => ({
                id: `cmod_intake_${Date.now()}_${idx}`,
                event_id: tempEventId,
                category_title: String(m.category_title || 'Custom Event Tab'),
                module_type:
                  m.module_type === 'speaking_order' ||
                  m.module_type === 'multi_day_itinerary' ||
                  m.module_type === 'cultural_rituals' ||
                  m.module_type === 'hotel_accommodation'
                    ? m.module_type
                    : 'custom_checklist',
                description: String(m.description || ''),
                location_context: String(
                  m.location_context || `${finalLocation} · ${finalDays}-Day Format`
                ),
                items: Array.isArray(m.items)
                  ? m.items.map((it: any, iIdx: number) => ({
                      id: `citem_intake_${Date.now()}_${idx}_${iIdx}`,
                      order_index: Number(it.order_index) || iIdx + 1,
                      title: String(it.title || 'Custom Step'),
                      role_or_day: String(it.role_or_day || `Order #${iIdx + 1}`),
                      person_or_lead: String(it.person_or_lead || 'Coordinator'),
                      notes: String(it.notes || ''),
                      completed: false,
                    }))
                  : [],
              }))
            : generateContextualCustomModules({
                eventId: tempEventId,
                eventType: finalType,
                location: finalLocation,
                eventDays: finalDays,
                customNotes: cleanMessage,
              });

        const builtHotels: HotelRoomBlockRecord[] =
          Array.isArray(parsed.hotel_blocks) && parsed.hotel_blocks.length > 0
            ? parsed.hotel_blocks.map((hb: any, hIdx: number) => ({
                id: `htl_intake_${Date.now()}_${hIdx}`,
                event_id: tempEventId,
                hotel_name: String(hb.hotel_name || `${finalLocation} Hotel`),
                room_type: String(hb.room_type || 'Group Room Block'),
                check_in_date: finalDate,
                check_out_date: finalDate,
                nights: Math.max(1, Number(hb.nights) || finalDays),
                rooms_blocked: Math.max(5, Number(hb.rooms_blocked) || 20),
                rooms_booked: Math.max(1, Number(hb.rooms_booked) || 10),
                nightly_rate: Math.max(45, Number(hb.nightly_rate) || 129),
                group_code: String(hb.group_code || 'GROUP-BLOCK'),
                shuttle_included: Boolean(hb.shuttle_included ?? true),
                assigned_guests_notes: String(
                  hb.assigned_guests_notes || 'Out-of-town family & guests block.'
                ),
                booking_status: 'contracted',
              }))
            : generateDefaultHotelBlocks({
                eventId: tempEventId,
                eventType: finalType,
                location: finalLocation,
                eventDate: finalDate,
                eventDays: finalDays,
              });

        res.json({
          assistantReply:
            parsed.assistant_reply ||
            `I have configured "${finalTitle}" (${finalType}, ${finalDays} day(s) in ${finalLocation} for ${finalGuests} guests) along with ${builtModules.length} custom event tabs (${builtModules
              .map((m) => m.category_title)
              .join(', ')}) and nearby hotel blocks. You can refine any detail here or click "Enter Workspace with Custom Tabs" to open your tailored event workspace.`,
          eventDraft: {
            id: tempEventId,
            title: finalTitle,
            event_type: finalType,
            location: finalLocation,
            event_days: finalDays,
            guest_count: finalGuests,
            target_budget: finalBudget,
            date: finalDate,
          },
          modules: builtModules,
          hotelBlocks: builtHotels,
        });
        return;
      } catch (err) {
        noteAiFailure('ai-intake-chat', err, ai, res);
        // Fall through to deterministic response below
      }
    }

    const fallbackModules = generateContextualCustomModules({
      eventId: tempEventId,
      eventType: detectedType,
      location: detectedLocation,
      eventDays: detectedDays,
      customNotes: cleanMessage,
    });
    const fallbackHotels = generateDefaultHotelBlocks({
      eventId: tempEventId,
      eventType: detectedType,
      location: detectedLocation,
      eventDate: detectedDate,
      eventDays: detectedDays,
    });

    res.json({
      assistantReply: `I've set up your blueprint for **${detectedTitle}** (${detectedType.toUpperCase()} · ${detectedDays} day(s) in ${detectedLocation} for ${detectedGuests} guests, $${detectedBudget.toLocaleString()} target budget).\n\nBased on your event type and location, I dynamically improvised **${fallbackModules.length} custom tabs**:\n${fallbackModules
        .map((m, i) => `${i + 1}. ${m.category_title} (${m.items.length} structured items)`)
        .join('\n')}\n\nPlus **${fallbackHotels.length} nearby hotel room blocks** in ${detectedLocation}. Tell me if you'd like to adjust any details, or click **Enter Workspace with Custom Tabs** to begin!`,
      eventDraft: {
        id: tempEventId,
        title: detectedTitle,
        event_type: detectedType,
        location: detectedLocation,
        event_days: detectedDays,
        guest_count: detectedGuests,
        target_budget: detectedBudget,
        date: detectedDate,
      },
      modules: fallbackModules,
      hotelBlocks: fallbackHotels,
    });
  });

  // 8. Nearby hotels: REAL hotels from OpenStreetMap (ODbL) + honest link-outs for live rates.
  // No prices, ratings, "savings" or brand listings are ever invented: nightly rates are not
  // available from open data, so each result links to a live Google Maps / Google Hotels search.
  app.post('/api/agents/search-nearby-hotels', async (req: Request, res: Response) => {
    const { location = 'Napa Valley, CA' } = req.body ?? {};
    const cleanLoc = sanitizeUntrustedInput(String(location).slice(0, 200)).sanitizedText;
    const cityQuery = cleanLoc.split('—')[0].trim() || cleanLoc;

    const geo = await geocode(cityQuery);
    const links = [
      {
        title: `Google Maps — hotels near ${cityQuery}`,
        uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hotels near ${cityQuery}`)}`,
      },
      {
        title: `Google Hotels — compare live rates in ${cityQuery}`,
        uri: `https://www.google.com/travel/hotels?q=${encodeURIComponent(`hotels in ${cityQuery}`)}`,
      },
    ];
    if (!geo) {
      res.json({
        location: cleanLoc,
        cityCenter: null,
        deals: [],
        notice: 'Could not locate that place on OpenStreetMap. Use the links below to search for hotels.',
        groundingSources: links,
        attribution: '© OpenStreetMap contributors',
      });
      return;
    }

    const hotels = await findHotelsNear(geo.lat, geo.lng, 8);
    const deals: LiveNearbyHotelDeal[] = hotels.map((h) => {
      const q = `${h.name}, ${h.address || cityQuery}`;
      return {
        id: h.id,
        hotel_name: h.name,
        neighborhood_or_address: h.address || cityQuery,
        distance_from_venue: `${h.distanceMiles} mi from ${cityQuery} centre`,
        price_per_night: 0, // unknown: see booking link
        original_retail_price: 0,
        savings_pct: 0,
        star_rating: h.stars ?? 0,
        tier_label: 'Nearby Hotel',
        amenities: [],
        booking_url:
          safeHttpUrl(h.website) ??
          `https://www.google.com/travel/hotels?q=${encodeURIComponent(q)}`,
        source_label: 'OpenStreetMap contributors (ODbL)',
        lat: h.lat,
        lng: h.lng,
        google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
        google_directions_url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`,
        google_embed_query: q,
      };
    });

    res.json({
      location: cleanLoc,
      cityCenter: { lat: geo.lat, lng: geo.lng },
      deals,
      notice:
        deals.length === 0
          ? 'No hotels are mapped on OpenStreetMap near that place. Use the links below to search live listings.'
          : 'Hotels come from OpenStreetMap. Nightly rates are not available from open data — use the booking links to see current prices.',
      groundingSources: links,
      attribution: '© OpenStreetMap contributors',
    });
  });

  // BYOK helpers. The key travels in the POST body over HTTPS, is used for one upstream call,
  // and is never stored or logged (errors are scrubbed with redactSecret).
  const readByok = (body: any) => {
    try {
      return validateAiConfig({
        provider: isProviderId(body?.provider) ? body.provider : undefined,
        apiKey: typeof body?.apiKey === 'string' ? body.apiKey : undefined,
        model: typeof body?.model === 'string' ? body.model : undefined,
        baseUrl: typeof body?.baseUrl === 'string' ? body.baseUrl : undefined,
      });
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Invalid AI configuration');
    }
  };

  app.post('/api/ai/models', async (req: Request, res: Response) => {
    const raw = req.body ?? {};
    // Listing does not need a chosen model: use a placeholder so validation passes.
    const cfg = readByok({ ...raw, model: raw.model || 'placeholder' });
    try {
      res.json({ models: await listModels(cfg) });
    } catch (err) {
      res.status(502).json({ error: redactSecret(err instanceof Error ? err.message : 'Could not list models', cfg.apiKey) });
    }
  });

  app.post('/api/ai/test', async (req: Request, res: Response) => {
    const cfg = readByok(req.body);
    try {
      const out = await testConnection(cfg);
      res.json({ ok: true, provider: cfg.provider, model: cfg.model, sample: out.sample });
    } catch (err) {
      res.status(502).json({ error: redactSecret(err instanceof Error ? err.message : 'Connection failed', cfg.apiKey) });
    }
  });

  // Geocoding for the OpenStreetMap embed (cached, throttled; see src/server/geo.ts)
  app.post('/api/geocode', async (req: Request, res: Response) => {
    const q = sanitizeUntrustedInput(String(req.body?.query ?? '').slice(0, 200)).sanitizedText;
    const geo = await geocode(q.split('—')[0].trim() || q);
    // 200 + found:false (not 404) so an upstream hiccup is not logged as a client error
    res.json(geo ?? { found: false });
  });

  // 9. Personalised idea generator (Gemini when available, deterministic engine otherwise)
  app.post('/api/agents/ideas', async (req: Request, res: Response) => {
    const b = req.body ?? {};
    const request = {
      eventType: String(b.eventType ?? 'community').slice(0, 60),
      title: String(b.title ?? '').slice(0, 120),
      location: String(b.location ?? '').slice(0, 120),
      guestCount: Math.min(50_000, Math.max(1, Math.round(Number(b.guestCount)) || 50)),
      targetBudget: Math.min(1e9, Math.max(0, Number(b.targetBudget) || 0)),
      interests: sanitizeUntrustedInput(String(b.interests ?? '').slice(0, 200)).sanitizedText,
      vibe: String(b.vibe ?? '').slice(0, 30),
    };
    const baseline: IdeaSet = generateIdeas(request, Math.floor(Math.random() * 1000));

    const ai = getAi(req);
    if (ai) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: ai.model,
            contents: `Event: ${JSON.stringify(request)}
Give 9 distinct, specific, personalised ideas (themes, activities, food & drink, decor, favors, guest experiences) plus 2 money-saving tips that fit the budget of about $${Math.round(request.targetBudget / request.guestCount)} per guest.`,
            config: {
              systemInstruction:
                'You are a warm, practical event-planning creative director. Be concrete and culturally sensitive. Never invent prices for specific vendors. estCostPerGuest is an estimate in USD.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  ideas: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        estCostPerGuest: { type: Type.NUMBER },
                      },
                    },
                  },
                },
              },
            },
          }),
          25_000
        );
        const parsed = parseModelJson(response.text);
        const allowed = new Set(['Theme', 'Activity', 'Food & Drink', 'Decor', 'Favor', 'Money-saver', 'Guest experience']);
        const ideas: IdeaCard[] = (Array.isArray(parsed.ideas) ? parsed.ideas : [])
          .filter((i: any) => i && typeof i.title === 'string' && i.title.trim())
          .slice(0, 14)
          .map((i: any, idx: number) => ({
            id: `ai-${Date.now()}-${idx}`,
            category: allowed.has(i.category) ? i.category : 'Guest experience',
            title: redactSensitiveStrings(String(i.title)).slice(0, 140),
            description: redactSensitiveStrings(String(i.description ?? '')).slice(0, 400),
            estCostPerGuest:
              Number.isFinite(Number(i.estCostPerGuest)) && Number(i.estCostPerGuest) > 0
                ? Math.round(Number(i.estCostPerGuest))
                : undefined,
          }));
        if (ideas.length >= 3) {
          res.json({ source: 'ai', provider: ai.provider, set: { ...baseline, ideas } });
          return;
        }
      } catch (err) {
        noteAiFailure('ideas', err, ai, res);
      }
    }
    res.json({ source: 'local', set: baseline });
  });

  // Unknown API routes return JSON, never the SPA shell
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Unknown API endpoint' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Works both from source (./dist next to server.ts) and from the bundled dist/server.mjs
    const distPath = path.basename(__dirname) === 'dist' ? __dirname : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Centralised error handler: malformed JSON, oversized bodies, unexpected throws
  app.use((err: any, _req: Request, res: Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) {
      if (!res.headersSent) res.status(err.status).json({ error: err.message });
      return;
    }
    const status = err?.status === 413 || err?.type === 'entity.too.large' ? 413 : err?.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 500) console.error('[server] unhandled error:', err);
    if (res.headersSent) return;
    res.status(status).json({
      error:
        status === 413
          ? 'That upload is too large.'
          : status === 400
            ? 'Malformed request body.'
            : 'Something went wrong on our side. Please try again.',
    });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlanGenie server running on http://0.0.0.0:${PORT}`);
    console.log(
      resolveAiConfig({ headers: {} } as Request)
        ? 'AI mode: BYOK (users bring their own key) + server default key; automatic local-engine fallback'
        : 'AI mode: BYOK — users add their own key in AI Settings; built-in engine until then'
    );
  });
  if (isProd && !process.env.ENCRYPTION_MASTER_KEY) {
    console.warn(
      '[config] ENCRYPTION_MASTER_KEY is not set — using a random per-process key (vault data will not survive restarts). Set a 32+ char secret.'
    );
  }
  if (isProd && process.env.ENCRYPTION_MASTER_KEY && process.env.ENCRYPTION_MASTER_KEY.length < 32) {
    console.error('[config] ENCRYPTION_MASTER_KEY must be at least 32 characters.');
    process.exit(1);
  }
  const shutdown = (signal: string) => {
    console.log(`${signal} received — shutting down gracefully`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  server.keepAliveTimeout = 65_000;
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use.` : err);
    process.exit(1);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception:', err);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
