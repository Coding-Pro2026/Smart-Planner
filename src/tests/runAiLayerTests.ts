import assert from 'node:assert/strict';
import {
  AiConfig,
  buildGenerateRequest,
  buildListModelsRequest,
  extractJson,
  normalizeRequest,
  parseGenerateResponse,
  parseModelList,
  redactSecret,
  toJsonSchema,
} from '../lib/llm/providers';
import { isPrivateIp, safeRequest } from '../server/netGuard';
import { createAiClient, validateAiConfig, listModels } from '../server/aiClient';
import { Type } from '../lib/llm/schemaType';
import { cleanTitle, sanitizeMoodboard, sanitizeOrchestratorOutput } from '../lib/llm/sanitize';

let passed = 0;
let failed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`[FAIL] ${name}\n       -> ${err instanceof Error ? err.message : err}`);
  }
}

const schema = {
  type: Type.OBJECT,
  properties: { reply: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.NUMBER } } },
};
const params = {
  contents: 'plan a party',
  config: { systemInstruction: 'be brief', responseMimeType: 'application/json', responseSchema: schema },
};
const KEY = 'sk-test-SECRETSECRETSECRET1234';

async function main() {
  console.log('\n=== BYOK AI LAYER & SSRF GUARD TESTS ===');

  await check('Schema converter maps Gemini Type.* to JSON Schema', () => {
    const js: any = toJsonSchema(schema);
    assert.equal(js.type, 'object');
    assert.equal(js.properties.items.items.type, 'number');
  });

  await check('Gemini request: header auth (no key in URL), schema + JSON mime', () => {
    const cfg: AiConfig = { provider: 'gemini', apiKey: KEY, model: 'models/gemini-2.5-flash' };
    const r = buildGenerateRequest(cfg, normalizeRequest(params));
    assert.ok(r.url.endsWith('/models/gemini-2.5-flash:generateContent'));
    assert.ok(!r.url.includes(KEY), 'key must not be in the URL');
    assert.equal(r.headers['x-goog-api-key'], KEY);
    const b = JSON.parse(r.body!);
    assert.equal(b.generationConfig.responseMimeType, 'application/json');
    assert.ok(b.systemInstruction.parts[0].text.startsWith('be brief') && b.systemInstruction.parts[0].text.includes('JSON Schema'));
    assert.equal(b.generationConfig.responseSchema, undefined, 'schema must be in the prompt, not responseSchema');
  });

  await check('Claude request: forced tool use for structured JSON, version header', () => {
    const r = buildGenerateRequest({ provider: 'anthropic', apiKey: KEY, model: 'claude-sonnet-5-5' }, normalizeRequest(params));
    const b = JSON.parse(r.body!);
    assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(r.headers['anthropic-version'], '2023-06-01');
    assert.deepEqual(b.tool_choice, { type: 'tool', name: 'respond' });
    assert.equal(b.tools[0].input_schema.type, 'object');
  });

  await check('OpenAI request: bearer auth, json_object, max_completion_tokens, schema in prompt', () => {
    const r = buildGenerateRequest({ provider: 'openai', apiKey: KEY, model: 'gpt-4o-mini' }, normalizeRequest(params));
    const b = JSON.parse(r.body!);
    assert.equal(r.headers.Authorization, `Bearer ${KEY}`);
    assert.deepEqual(b.response_format, { type: 'json_object' });
    assert.equal(b.max_completion_tokens, 4096);
    assert.ok(b.messages[0].content.includes('JSON Schema'));
  });

  await check('OpenRouter & custom: compatible endpoint, max_tokens, custom base URL honoured', () => {
    const or = buildGenerateRequest({ provider: 'openrouter', apiKey: KEY, model: 'openai/gpt-4o-mini' }, normalizeRequest(params));
    assert.equal(or.url, 'https://openrouter.ai/api/v1/chat/completions');
    const cu = buildGenerateRequest({ provider: 'custom', model: 'llama3', baseUrl: 'https://llm.example.com/v1/' }, normalizeRequest(params));
    assert.equal(cu.url, 'https://llm.example.com/v1/chat/completions');
    assert.equal(cu.headers.Authorization, undefined, 'no key => no auth header');
    assert.equal(JSON.parse(cu.body!).max_tokens, 4096);
  });

  await check('Image parts are translated per provider', () => {
    const p = { contents: { parts: [{ inlineData: { mimeType: 'image/png', data: 'QUJD' } }, { text: 'describe' }] } };
    const n = normalizeRequest(p);
    assert.ok(JSON.parse(buildGenerateRequest({ provider: 'anthropic', apiKey: KEY, model: 'm' }, n).body!).messages[0].content[0].source);
    assert.ok(JSON.parse(buildGenerateRequest({ provider: 'openai', apiKey: KEY, model: 'm' }, n).body!).messages[0].content[0].image_url.url.startsWith('data:image/png;base64,'));
    assert.ok(JSON.parse(buildGenerateRequest({ provider: 'gemini', apiKey: KEY, model: 'm' }, n).body!).contents[0].parts[0].inlineData);
  });

  await check('Response parsers: Gemini, Claude tool_use, OpenAI; empty => readable error', () => {
    assert.equal(parseGenerateResponse('gemini', { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }).text, '{"a":1}');
    assert.equal(parseGenerateResponse('anthropic', { content: [{ type: 'tool_use', input: { a: 1 } }] }).text, '{"a":1}');
    assert.equal(parseGenerateResponse('openai', { choices: [{ message: { content: '{"a":1}' } }] }).text, '{"a":1}');
    assert.throws(() => parseGenerateResponse('openai', { choices: [{ message: { content: '' }, finish_reason: 'length' }] }), /length/);
    assert.throws(() => parseGenerateResponse('gemini', { promptFeedback: { blockReason: 'SAFETY' } }), /SAFETY/);
  });

  await check('extractJson handles fences and surrounding prose', () => {
    assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}');
    assert.equal(JSON.parse(extractJson('Sure! Here you go: {"a":"}{","b":[1,2]} hope it helps')).b[1], 2);
  });

  await check('Model list parsers filter & sort', () => {
    assert.deepEqual(parseModelList('gemini', { models: [{ name: 'models/b', supportedGenerationMethods: ['generateContent'] }, { name: 'models/emb', supportedGenerationMethods: ['embedContent'] }] }).map((m) => m.id), ['b']);
    assert.deepEqual(parseModelList('openai', { data: [{ id: 'gpt-4o' }, { id: 'text-embedding-3' }, { id: 'whisper-1' }] }).map((m) => m.id), ['gpt-4o']);
    assert.equal(buildListModelsRequest({ provider: 'openrouter', model: 'x' }).headers.Authorization, undefined);
  });

  await check('Secrets are redacted from error text', () => {
    const msg = redactSecret(`Incorrect API key provided: ${KEY} and sk-abcdefghijklmnopqrstuvwxyz`, KEY);
    assert.ok(!msg.includes('SECRETSECRET'));
    assert.ok(!msg.includes('abcdefghijklmnop'));
  });

  await check('Config validation: provider, key, model, URL rules', () => {
    assert.throws(() => validateAiConfig({ provider: 'openai', model: 'x' }), /needs an API key/);
    assert.throws(() => validateAiConfig({ provider: 'evil' as any, apiKey: KEY }), /Unknown/);
    assert.throws(() => validateAiConfig({ provider: 'openai', apiKey: 'bad key with spaces' }), /invalid characters/);
    assert.throws(() => validateAiConfig({ provider: 'openai', apiKey: KEY, model: 'm"; drop' }), /invalid characters/);
    assert.throws(() => validateAiConfig({ provider: 'custom', model: 'm' }), /base URL/);
    assert.throws(() => validateAiConfig({ provider: 'custom', model: 'm', baseUrl: 'http://example.com/v1' }), /https/);
    assert.throws(() => validateAiConfig({ provider: 'custom', model: 'm', baseUrl: 'https://u:p@example.com/v1' }), /credentials/);
    assert.equal(validateAiConfig({ provider: 'custom', model: 'm', baseUrl: 'https://api.groq.com/openai/v1/' }).baseUrl, 'https://api.groq.com/openai/v1');
    assert.equal(validateAiConfig({ provider: 'gemini', apiKey: KEY }).model, 'gemini-3.1-flash-lite');
  });

  await check('SSRF: private, loopback, metadata & mapped IPs are classified private', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.16.5.5', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe']) {
      assert.ok(isPrivateIp(ip), `${ip} should be private`);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111']) assert.ok(!isPrivateIp(ip), `${ip} should be public`);
  });

  await check('SSRF: safeRequest refuses localhost, metadata IP, http, creds, localhost-by-DNS', async () => {
    for (const url of ['https://127.0.0.1/x', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/x', 'http://example.com/x', 'https://user:pw@example.com/x', 'https://localhost/x']) {
      await assert.rejects(safeRequest(url, { method: 'GET', timeoutMs: 3000 }), () => true, `should reject ${url}`);
    }
  });

  await check('Client: OpenRouter/custom retry without response_format after a 400', async () => {
    const calls: any[] = [];
    const fetcher: any = async (_u: string, o: any) => {
      calls.push(JSON.parse(o.body));
      return calls.length === 1
        ? { status: 400, headers: {}, text: JSON.stringify({ error: { message: 'response_format unsupported' } }) }
        : { status: 200, headers: {}, text: JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }) };
    };
    const c = createAiClient({ provider: 'openrouter', apiKey: KEY, model: 'x/y' }, true, fetcher);
    const out = await c.models.generateContent(params);
    assert.equal(out.text, '{"ok":true}');
    assert.ok(calls[0].response_format && !calls[1].response_format);
  });

  await check('Client: provider errors never leak the key', async () => {
    const fetcher: any = async () => ({ status: 401, headers: {}, text: JSON.stringify({ error: { message: `Invalid key ${KEY}` } }) });
    const c = createAiClient({ provider: 'openai', apiKey: KEY, model: 'gpt-4o-mini' }, true, fetcher);
    await assert.rejects(c.models.generateContent(params), (e: Error) => !e.message.includes('SECRETSECRET') && /401/.test(e.message));
  });

  await check('Client: Search-grounding tool is stripped for non-Gemini providers', async () => {
    let body: any;
    const fetcher: any = async (_u: string, o: any) => {
      body = JSON.parse(o.body);
      return { status: 200, headers: {}, text: JSON.stringify({ choices: [{ message: { content: 'hi' } }] }) };
    };
    await createAiClient({ provider: 'openai', apiKey: KEY, model: 'm' }, true, fetcher).models.generateContent({ contents: 'x', config: { tools: [{ googleSearch: {} }] } });
    assert.ok(!('tools' in body));
  });

  await check('listModels uses the provider-specific request and parses the result', async () => {
    let seen = '';
    const fetcher: any = async (u: string) => {
      seen = u;
      return { status: 200, headers: {}, text: JSON.stringify({ data: [{ id: 'claude-b' }, { id: 'claude-a' }] }) };
    };
    const m = await listModels({ provider: 'anthropic', apiKey: KEY, model: 'x' }, fetcher);
    assert.ok(seen.startsWith('https://api.anthropic.com/v1/models'));
    assert.deepEqual(m.map((x) => x.id), ['claude-a', 'claude-b']);
  });

  await check('Model output sanitizers reject malformed/off-spec fields', () => {
    const o = sanitizeOrchestratorOutput({ sender_agent: 'Supervisor Agent PlanGenie coordination unit v1.0.0.0', delegated_agents: ['Nope', 'Budget Allocator Agent'], reply_markdown: 'hi', proposed_actions: [{ tool_name: 'rm_rf', summary: 'x' }, { tool_name: 'add_budget_item', agent: 'Evil', summary: 's' }] });
    assert.equal(o.sender_agent, 'Supervisor Agent');
    assert.deepEqual(o.delegated_agents, ['Budget Allocator Agent']);
    assert.equal(o.actions.length, 1);
    assert.equal(o.actions[0].agent, 'Logistics & Timeline Agent');
    assert.equal(sanitizeMoodboard({ title: 'T', color_Swatches: [{ hex: 'red' }, { hex: '#12' }] }, 'e'), null);
    assert.equal(sanitizeMoodboard({ title: 'Sage Edit:525252,color_Swatches:[{hex:', color_Swatches: ['#4A5D4E', '#C67D5A', '#F3EFEA'].map((hex) => ({ hex, name: 'n', usage: 'u' })) }, 'e')!.title, 'Custom Palette');
    assert.equal(cleanTitle('x'.repeat(300), 'fb', 40).length, 40);
    assert.equal(cleanTitle('{"a":1}', 'fb'), 'fb');
  });

  await check('Orchestrator: an empty model response is detectable (triggers local fallback)', () => {
    const o = sanitizeOrchestratorOutput({});
    assert.equal(o.hasReply, false);
    assert.equal(o.actions.length, 0);
    assert.equal(sanitizeOrchestratorOutput({ reply_markdown: 'ok' }).hasReply, true);
  });

  console.log(`\nAI layer: ${passed}/${passed + failed} checks passed`);
  if (failed) process.exit(1);
}
main();
