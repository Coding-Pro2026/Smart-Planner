"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { clearConfig, loadConfig, saveConfig, type ClientLlmConfig } from "@/lib/client/keystore";
import { useMe } from "@/lib/client/hooks";
import { DEFAULT_MODELS, PROVIDERS, type Provider } from "@/lib/llm/types";
import { Badge, Button, Card, ErrorNote, Field, Spinner } from "@/components/ui";

const blank = (p: Provider): ClientLlmConfig => ({ mode: "session", provider: p, apiKey: "", baseUrl: DEFAULT_MODELS[p].baseUrl ?? "", fastModel: DEFAULT_MODELS[p].fast, reasoningModel: DEFAULT_MODELS[p].reasoning });

export default function SettingsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<ClientLlmConfig>(blank("openai"));
  const [active, setActive] = useState<ClientLlmConfig | null>(null);
  const vault = useQuery({ queryKey: ["vault"], queryFn: () => api<{ providers: { provider: Provider; hint?: string; fastModel: string; reasoningModel: string }[] }>("/llm/vault"), enabled: !!me.data?.vaultEnabled });

  useEffect(() => { loadConfig().then((c) => { setActive(c); if (c && c.mode === "session") setCfg(c); }); }, []);
  const needsKey = DEFAULT_MODELS[cfg.provider].needsKey;
  const usesBase = cfg.provider === "ollama" || cfg.provider === "custom";

  const save = useMutation({
    mutationFn: async () => {
      const body = { provider: cfg.provider, apiKey: cfg.apiKey || undefined, baseUrl: usesBase ? cfg.baseUrl || undefined : undefined, fastModel: cfg.fastModel, reasoningModel: cfg.reasoningModel };
      if (cfg.mode === "vault") await api("/llm/vault", { method: "PUT", body });
      else await api("/llm/validate", { body }); // minimal ping BEFORE anything is stored
      await saveConfig({ ...cfg, ...body, mode: cfg.mode });
      setActive(await loadConfig());
      setCfg((c) => ({ ...c, apiKey: "" }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault"] }),
  });
  const del = useMutation({
    mutationFn: (provider: string) => api("/llm/vault", { method: "DELETE", body: { provider } }),
    onSuccess: () => { clearConfig(); setActive(null); qc.invalidateQueries({ queryKey: ["vault"] }); },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <h1 className="text-2xl font-bold">AI model &amp; API keys</h1>
      <p className="text-sm text-muted">Bring your own key. Use a fast model for checklists and a reasoning/vision model for budgets, quotes and mood boards. The planner works without a key too — only the AI assistant, quote parsing and mood-board features need one.</p>

      {active && (
        <Card className="flex items-center gap-3 border-ok/40">
          <CheckCircle2 className="h-5 w-5 text-ok" />
          <div className="text-sm"><b>{DEFAULT_MODELS[active.provider].label}</b> is active ({active.mode === "vault" ? "encrypted vault" : "this tab only"}) · fast <code>{active.fastModel}</code> · reasoning <code>{active.reasoningModel}</code></div>
        </Card>
      )}

      <Card className="space-y-5">
        <Field label="Storage mode">
          <div className="grid gap-3 sm:grid-cols-2">
            {([["session", "Session-only (recommended)", "Key is encrypted in your browser and forgotten when you close the tab. Sent to our server only to make each AI call, never saved."], ["vault", "Vault", "Key is stored AES-256-GCM encrypted on the server so it works across devices. Never shown again."]] as const).map(([v, t, d]) => (
              <button key={v} type="button" disabled={v === "vault" && !me.data?.vaultEnabled} onClick={() => setCfg({ ...cfg, mode: v })} className={`rounded-lg border p-3 text-left text-sm disabled:opacity-40 ${cfg.mode === v ? "border-brand bg-brand-soft" : "border-line"}`}>
                <div className="font-medium">{t}</div><div className="text-xs text-muted">{d}</div>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <select className="w-full" value={cfg.provider} onChange={(e) => setCfg({ ...blank(e.target.value as Provider), mode: cfg.mode })}>{PROVIDERS.map((p) => <option key={p} value={p}>{DEFAULT_MODELS[p].label}</option>)}</select>
          </Field>
          {needsKey || cfg.provider === "custom" ? (
            <Field label={needsKey ? "API key" : "API key (optional)"}><input className="w-full" type="password" autoComplete="off" spellCheck={false} value={cfg.apiKey ?? ""} onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })} placeholder={cfg.mode === "vault" && vault.data?.providers.some((p) => p.provider === cfg.provider) ? "Saved — enter a new key to replace" : "sk-…"} /></Field>
          ) : <div />}
          {usesBase && <div className="sm:col-span-2"><Field label="Base URL" hint="OpenAI-compatible endpoint, e.g. http://localhost:11434/v1 for Ollama. Private addresses need ALLOW_PRIVATE_LLM_ENDPOINTS=true on the server."><input className="w-full" value={cfg.baseUrl ?? ""} onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })} /></Field></div>}
          <Field label="Fast model" hint="Categorising, checklists, routing"><input className="w-full" value={cfg.fastModel} onChange={(e) => setCfg({ ...cfg, fastModel: e.target.value })} /></Field>
          <Field label="Reasoning / vision model" hint="Budget trade-offs, quote extraction, mood boards"><input className="w-full" value={cfg.reasoningModel} onChange={(e) => setCfg({ ...cfg, reasoningModel: e.target.value })} /></Field>
        </div>

        <ErrorNote error={save.error} />
        {save.isSuccess && <p className="flex items-center gap-2 text-sm text-ok"><ShieldCheck className="h-4 w-4" /> Connection verified and saved.</p>}
        <Button loading={save.isPending} onClick={() => save.mutate()} disabled={!cfg.fastModel || !cfg.reasoningModel || (needsKey && !cfg.apiKey && cfg.mode === "session")}>Test connection &amp; save</Button>
      </Card>

      {me.data?.vaultEnabled && (
        <Card>
          <h2 className="mb-3 font-semibold">Vault</h2>
          {vault.isLoading ? <Spinner /> : vault.data?.providers.length ? (
            <ul className="divide-y divide-line">
              {vault.data.providers.map((p) => (
                <li key={p.provider} className="flex items-center justify-between py-2 text-sm">
                  <span><b>{DEFAULT_MODELS[p.provider]?.label ?? p.provider}</b> <Badge>{p.hint ?? "no key"}</Badge></span>
                  <Button variant="ghost" size="sm" onClick={() => del.mutate(p.provider)} aria-label={`Delete ${p.provider}`}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nothing saved.</p>}
        </Card>
      )}
      {active && <Button variant="outline" onClick={() => { clearConfig(); setActive(null); }}>Forget key on this device</Button>}
    </main>
  );
}
