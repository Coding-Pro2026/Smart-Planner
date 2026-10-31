import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { PROVIDERS, PROVIDER_IDS, ProviderId } from '../lib/llm/providers';
import { StoredAiConfig, clearAiConfig, isAiConfigured, loadAiConfig, saveAiConfig } from '../lib/aiConfig';
import { postJson } from '../lib/api';

const CUSTOM_PRESETS: { label: string; url: string }[] = [
  { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
  { label: 'Together', url: 'https://api.together.xyz/v1' },
  { label: 'Mistral', url: 'https://api.mistral.ai/v1' },
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
];

const emptyFor = (p: ProviderId): StoredAiConfig => ({
  provider: p,
  apiKey: '',
  model: PROVIDERS[p].defaultModel,
  baseUrl: '',
  remember: false,
});

export function AiSettingsModal({
  isOpen,
  onClose,
  onToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  onToast: (kind: 'success' | 'error' | 'info', text: string) => void;
}) {
  const [cfg, setCfg] = useState<StoredAiConfig>(() => loadAiConfig() ?? emptyFor('gemini'));
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<{ id: string; label?: string }[]>([]);
  const [busy, setBusy] = useState<'models' | 'test' | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCfg(loadAiConfig() ?? emptyFor('gemini'));
    setModels([]);
    setStatus(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const meta = PROVIDERS[cfg.provider];
  const set = (patch: Partial<StoredAiConfig>) => setCfg((c) => ({ ...c, ...patch }));

  const switchProvider = (p: ProviderId) => {
    setCfg((c) => ({ ...emptyFor(p), remember: c.remember, apiKey: c.provider === p ? c.apiKey : '' }));
    setModels([]);
    setStatus(null);
  };

  const body = () => ({
    provider: cfg.provider,
    apiKey: cfg.apiKey.trim(),
    model: cfg.model.trim(),
    baseUrl: cfg.baseUrl.trim(),
  });

  // Listing models only needs credentials (the model is what you're about to choose);
  // testing/saving also needs a model.
  const canList = (!meta.needsKey || cfg.apiKey.trim().length > 0) && (!meta.needsBaseUrl || cfg.baseUrl.trim().length > 0);
  const canCall = canList && Boolean(cfg.model.trim() || meta.defaultModel);

  const loadModels = async () => {
    setBusy('models');
    setStatus(null);
    const res = await postJson<{ models: { id: string; label?: string }[] }>('/api/ai/models', body(), { timeoutMs: 20_000 });
    setBusy(null);
    if (res.ok && Array.isArray(res.data?.models)) {
      setModels(res.data.models);
      setStatus({ kind: 'ok', text: `${res.data.models.length} models available — pick one below.` });
    } else {
      setStatus({ kind: 'error', text: res.ok ? 'No models returned.' : res.error });
    }
  };

  const test = async () => {
    setBusy('test');
    setStatus(null);
    const res = await postJson<{ ok: boolean; sample: string }>('/api/ai/test', body(), { timeoutMs: 35_000 });
    setBusy(null);
    setStatus(
      res.ok
        ? { kind: 'ok', text: `Connected! ${meta.label} replied: “${res.data.sample}”.` }
        : { kind: 'error', text: res.error }
    );
  };

  const save = () => {
    const clean = { ...cfg, apiKey: cfg.apiKey.trim(), baseUrl: cfg.baseUrl.trim(), model: cfg.model.trim() || meta.defaultModel };
    if (!isAiConfigured(clean)) {
      setStatus({ kind: 'error', text: meta.needsKey ? 'Paste your API key first.' : 'Enter the base URL and model.' });
      return;
    }
    saveAiConfig(clean);
    onToast('success', `AI connected: ${meta.label} (${clean.model})`);
    onClose();
  };

  const remove = () => {
    clearAiConfig();
    setCfg(emptyFor(cfg.provider));
    onToast('info', 'API key removed from this browser. PlanGenie will use the built-in engine.');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI settings"
        className="bg-white border border-stone-200 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-xl"
      >
        <div className="px-6 py-4 border-b border-stone-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#4A6B53]" /> Bring your own AI key
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Pick a provider, paste your key and choose a model. Everything works without a key too (built-in engine).
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Provider">
            {PROVIDER_IDS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={cfg.provider === p}
                onClick={() => switchProvider(p)}
                className={`px-2 py-2.5 rounded-xl font-semibold border transition-colors ${
                  cfg.provider === p
                    ? 'bg-[#4A6B53] text-white border-[#4A6B53]'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {PROVIDERS[p].label.replace(' (OpenAI-compatible)', '')}
              </button>
            ))}
          </div>
          <p className="text-stone-500">{meta.blurb}</p>

          {meta.needsBaseUrl && (
            <div className="space-y-1.5">
              <label htmlFor="ai-base" className="block font-medium text-stone-700">Base URL (https, OpenAI-compatible)</label>
              <input
                id="ai-base"
                type="url"
                value={cfg.baseUrl}
                onChange={(e) => set({ baseUrl: e.target.value })}
                placeholder="https://api.groq.com/openai/v1"
                className="w-full px-3.5 py-2 border border-stone-300 rounded-xl font-mono"
              />
              <div className="flex flex-wrap gap-1.5">
                {CUSTOM_PRESETS.map((p) => (
                  <button key={p.label} type="button" onClick={() => set({ baseUrl: p.url })} className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700">
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-stone-400">
                Local servers (Ollama, LM Studio) only work when you run PlanGenie on your own machine with <code>ALLOW_PRIVATE_AI_URLS=true</code>.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="ai-key" className="block font-medium text-stone-700">
                API key {!meta.needsKey && <span className="text-stone-400">(optional)</span>}
              </label>
              {meta.keyHelpUrl && (
                <a href={meta.keyHelpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#4A6B53] hover:underline">
                  Get a key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="relative">
              <input
                id="ai-key"
                type={showKey ? 'text' : 'password'}
                value={cfg.apiKey}
                onChange={(e) => set({ apiKey: e.target.value })}
                placeholder={meta.keyPlaceholder}
                autoComplete="off"
                spellCheck={false}
                className="w-full pl-3.5 pr-10 py-2 border border-stone-300 rounded-xl font-mono"
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide key' : 'Show key'} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="ai-model" className="block font-medium text-stone-700">Model</label>
              <button
                type="button"
                onClick={loadModels}
                disabled={!canList || busy !== null}
                className="inline-flex items-center gap-1 text-[#4A6B53] hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {busy === 'models' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Load my models
              </button>
            </div>
            <input
              id="ai-model"
              list="ai-model-options"
              value={cfg.model}
              onChange={(e) => set({ model: e.target.value })}
              placeholder={meta.defaultModel || 'model id, e.g. llama-3.3-70b-versatile'}
              className="w-full px-3.5 py-2 border border-stone-300 rounded-xl font-mono"
            />
            <datalist id="ai-model-options">
              {(models.length ? models.map((m) => m.id) : meta.suggestedModels).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {models.length === 0 && meta.suggestedModels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {meta.suggestedModels.map((m) => (
                  <button key={m} type="button" onClick={() => set({ model: m })} className={`px-2.5 py-1 rounded-lg font-mono ${cfg.model === m ? 'bg-[#EDF3EE] text-[#3b5943]' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            {models.length > 0 && (
              <select size={5} value={cfg.model} onChange={(e) => set({ model: e.target.value })} className="w-full border border-stone-300 rounded-xl p-1 font-mono">
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label ? `${m.label} — ${m.id}` : m.id}</option>
                ))}
              </select>
            )}
          </div>

          <label className="flex items-start gap-2.5 text-stone-700">
            <input type="checkbox" checked={cfg.remember} onChange={(e) => set({ remember: e.target.checked })} className="mt-0.5" />
            <span>
              Remember on this device
              <span className="block text-[11px] text-stone-400">
                Off (recommended on shared computers): the key is forgotten when you close the tab.
              </span>
            </span>
          </label>

          <div className="flex items-start gap-2 p-3 rounded-2xl bg-[#EDF3EE] text-[#3b5943]">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Your key stays in this browser and is sent over HTTPS only to the PlanGenie server you are using, which uses it for
              your requests to {meta.label} and never stores or logs it. Usage is billed by your provider to you.
              Your event details (names, budget, notes) are sent to that provider to generate answers. See the <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>.
            </p>
          </div>

          {status && (
            <div role={status.kind === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl border flex items-start gap-2 ${status.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              {status.kind === 'ok' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{status.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl">
              <Trash2 className="w-3.5 h-3.5" /> Remove key
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={test} disabled={!canCall || busy !== null} className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 rounded-xl">
                {busy === 'test' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Test connection
              </button>
              <button type="button" onClick={save} className="px-5 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
