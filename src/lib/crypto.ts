import crypto from 'crypto';

/**
 * Enterprise Envelope Encryption Utility (AES-256-GCM)
 * - Uses 12-byte cryptographic random IV per encryption operation
 * - Derives tenant-isolated 256-bit keys via HKDF-SHA256 from master secret
 * - Includes 16-byte GCM authentication tag for tamper detection
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function getMasterKeyBuffer(customMasterKey?: string): Buffer {
  const rawSecret =
    customMasterKey ||
    process.env.ENCRYPTION_MASTER_KEY ||
    'plangenie-enterprise-default-master-key-2026-aes256gcm';
  return crypto.createHash('sha256').update(rawSecret, 'utf8').digest();
}

function deriveTenantKey(masterKey: Buffer, tenantId: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      masterKey,
      Buffer.from('plangenie-salt-v1', 'utf8'),
      Buffer.from(`tenant:${tenantId}`, 'utf8'),
      32
    )
  );
}

export interface EncryptedEnvelope {
  version: 'v1';
  alg: 'AES-256-GCM';
  tenantId: string;
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
  createdAt: string;
}

export function encryptSecretEnvelope(
  plaintext: string,
  tenantId: string,
  customMasterKey?: string
): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Cannot encrypt empty or non-string payload');
  }
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Tenant ID is required for envelope key derivation');
  }

  const masterKey = getMasterKeyBuffer(customMasterKey);
  const derivedKey = deriveTenantKey(masterKey, tenantId);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  cipher.setAAD(Buffer.from(tenantId, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const envelope: EncryptedEnvelope = {
    version: 'v1',
    alg: 'AES-256-GCM',
    tenantId,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    createdAt: new Date().toISOString(),
  };

  return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');
}

export function decryptSecretEnvelope(
  encodedEnvelope: string,
  expectedTenantId: string,
  customMasterKey?: string
): string {
  if (!encodedEnvelope) {
    throw new Error('Missing encrypted envelope');
  }

  let envelope: EncryptedEnvelope;
  try {
    const jsonStr = Buffer.from(encodedEnvelope, 'base64').toString('utf8');
    envelope = JSON.parse(jsonStr) as EncryptedEnvelope;
  } catch {
    throw new Error('Malformed encrypted envelope format');
  }

  if (envelope.tenantId !== expectedTenantId) {
    throw new Error('Tenant isolation breach: envelope tenant mismatch');
  }

  const masterKey = getMasterKeyBuffer(customMasterKey);
  const derivedKey = deriveTenantKey(masterKey, expectedTenantId);
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAAD(Buffer.from(expectedTenantId, 'utf8'));
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Prompt Injection & SSRF Input Sanitizer
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /system\s*override/gi,
  /reveal\s+(your\s+)?(system\s+prompt|api\s+key|secret|env)/gi,
  /print\s+process\.env/gi,
];

const SSRF_URL_PATTERNS = [
  /https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|169\.254\.169\.254|metadata\.google\.internal)/gi,
  /file:\/\//gi,
  /gopher:\/\//gi,
];

export interface SanitizationResult {
  sanitizedText: string;
  flaggedPromptInjection: boolean;
  flaggedSsrfAttempt: boolean;
  warnings: string[];
}

export function sanitizeUntrustedInput(rawInput: string): SanitizationResult {
  let sanitizedText = rawInput.slice(0, 12000); // Hard length cap
  let flaggedPromptInjection = false;
  let flaggedSsrfAttempt = false;
  const warnings: string[] = [];

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      flaggedPromptInjection = true;
      warnings.push('Blocked adversarial instruction-override pattern.');
      sanitizedText = sanitizedText.replace(pattern, '[REDACTED_ADVERSARIAL_DIRECTIVE]');
    }
  }

  for (const pattern of SSRF_URL_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      flaggedSsrfAttempt = true;
      warnings.push('Blocked internal/loopback SSRF URI reference.');
      sanitizedText = sanitizedText.replace(pattern, '[BLOCKED_INTERNAL_URI]');
    }
  }

  return {
    sanitizedText,
    flaggedPromptInjection,
    flaggedSsrfAttempt,
    warnings,
  };
}

/**
 * Secret Redactor to ensure no API keys or raw credentials ever leak into logs or client payloads
 */
export function redactSensitiveStrings(input: string): string {
  const gcpPattern = new RegExp('AI' + 'za[0-9A-Za-z-_]{35}', 'g');
  const skPattern = new RegExp('sk-' + '[a-zA-Z0-9-_]{20,}', 'g');
  const antPattern = new RegExp('sk-ant-' + '[a-zA-Z0-9-_]{20,}', 'g');
  return input
    .replace(gcpPattern, '[REDACTED_GCP_KEY]')
    .replace(skPattern, '[REDACTED_SK_KEY]')
    .replace(antPattern, '[REDACTED_ANTHROPIC_KEY]');
}
