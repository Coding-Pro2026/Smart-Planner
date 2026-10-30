"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ImagePlus, Send, Sparkles, X } from "lucide-react";
import { api, fileToBase64, fmtMoney2 } from "@/lib/client/api";
import { loadConfig } from "@/lib/client/keystore";
import type { Palette } from "@/lib/client/hooks";
import { useEvent } from "@/lib/client/hooks";
import type { Action } from "@/lib/agent/tools";
import { Badge, Button, Card, ErrorNote, cn } from "@/components/ui";

interface Proposal { id: string; summary: string; actions: Action[]; state?: "pending" | "accepted" | "rejected" }
interface Msg { role: "user" | "assistant"; content: string; warnings?: string[]; proposal?: Proposal; palette?: Palette | null; agents?: string[]; hasComparison?: boolean }

const SUGGESTIONS = [
  "Break this event into milestones counting back from the event date",
  "Suggest a budget split and add the main line items",
  "Give me three theme ideas with colour palettes and a menu",
  "The venue contract slipped by two weeks — what moves?",
];

export default function AssistantPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const ev = useEvent(eventId).data?.event;
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Hi! I can plan the timeline, draft budget line items, suggest themes from a mood board and compare vendor quotes. Anything I want to change in your plan will appear as a proposal for you to accept or reject." }]);
  const [text, setText] = useState("");
  const [img, setImg] = useState<{ mime: "image/png" | "image/jpeg" | "image/webp"; base64: string; name: string } | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { loadConfig().then((c) => setConfigured(!!c)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = useMutation({
    mutationFn: async (message: string) => {
      const history = msgs.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
      return api<{ reply: string; warnings: string[]; proposal: Proposal | null; palette: Palette | null; agents: string[]; comparison: unknown }>(`/events/${eventId}/chat`, { body: { message, history, image: img ? { mime: img.mime, base64: img.base64 } : undefined }, llm: true });
    },
    onSuccess: (r) => {
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, warnings: r.warnings, proposal: r.proposal ? { ...r.proposal, state: "pending" } : undefined, palette: r.palette, agents: r.agents, hasComparison: !!r.comparison }]);
      setImg(null);
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "accept" | "reject" }) => api(`/events/${eventId}/proposals/${id}`, { body: { decision } }).then(() => ({ id, decision })),
    onSuccess: ({ id, decision }) => {
      setMsgs((ms) => ms.map((m) => (m.proposal?.id === id ? { ...m, proposal: { ...m.proposal, state: decision === "accept" ? "accepted" : "rejected" } } : m)));
      if (decision === "accept") ["tasks", "budget", "event"].forEach((k) => qc.invalidateQueries({ queryKey: [k, eventId] }));
    },
  });

  function submit(message: string) {
    if (!message.trim() || send.isPending) return;
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setText("");
    send.mutate(message);
  }
  async function pick(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return alert("Use a PNG, JPEG or WebP image");
    if (file.size > 4_000_000) return alert("Image must be under 4 MB");
    setImg({ mime: file.type as "image/png", base64: await fileToBase64(file), name: file.name });
  }

  if (ev && ev.role !== "owner" && ev.role !== "editor") return <p className="text-sm text-muted">You need edit access to use the assistant.</p>;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {configured === false && <Card className="border-warn/50 text-sm">The assistant needs an AI model. <Link className="text-brand underline" href="/settings">Add your API key</Link> (OpenAI, Anthropic, Gemini, OpenRouter or a local Ollama).</Card>}
      <div className="min-h-[50vh] space-y-4" aria-live="polite">
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[90%] space-y-3 rounded-2xl px-4 py-3 text-sm", m.role === "user" ? "bg-brand text-white dark:text-black" : "border border-line bg-card")}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.agents && m.agents.length > 0 && <div className="flex gap-1">{m.agents.map((a) => <Badge key={a} tone="brand">{a}</Badge>)}</div>}
              {m.palette && (
                <div className="space-y-2"><div className="flex flex-wrap gap-2">{m.palette.colors.map((c) => <div key={c.hex} className="text-center text-[10px]"><div className="h-10 w-10 rounded-lg border border-line" style={{ background: c.hex }} />{c.hex}</div>)}</div><p className="text-xs text-muted">{m.palette.summary}</p>{m.palette.decorElements.length > 0 && <p className="text-xs"><b>Decor:</b> {m.palette.decorElements.join(", ")}</p>}{m.palette.dietarySuggestions.length > 0 && <p className="text-xs"><b>Menu:</b> {m.palette.dietarySuggestions.join(", ")}</p>}</div>
              )}
              {m.hasComparison && <p className="text-xs text-muted">A side-by-side comparison is ready on the <Link className="text-brand underline" href={`/events/${eventId}/vendors`}>Vendors tab</Link>.</p>}
              {m.warnings?.map((w) => <p key={w} className="text-xs text-warn">⚠ {w}</p>)}
              {m.proposal && <ProposalBanner p={m.proposal} currency={ev?.currency ?? "USD"} busy={decide.isPending} onDecide={(d) => decide.mutate({ id: m.proposal!.id, decision: d })} />}
            </div>
          </motion.div>
        ))}
        <AnimatePresence>{send.isPending && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-muted"><Sparkles className="h-4 w-4 animate-pulse text-brand" /> Thinking…</motion.div>}</AnimatePresence>
        <div ref={endRef} />
      </div>
      <ErrorNote error={send.error ?? decide.error} />
      {msgs.length < 3 && <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} className="rounded-full border border-line px-3 py-1 text-xs hover:bg-brand-soft" onClick={() => submit(s)}>{s}</button>)}</div>}
      <form className="sticky bottom-3 flex items-end gap-2 rounded-2xl border border-line bg-card p-2 shadow-lg" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <label className="cursor-pointer rounded-lg p-2 hover:bg-brand-soft" title="Attach a mood board image"><ImagePlus className="h-5 w-5" /><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} /></label>
        <div className="flex-1">
          {img && <div className="mb-1 flex items-center gap-1 text-xs text-muted"><Badge tone="brand">{img.name}</Badge><button type="button" onClick={() => setImg(null)} aria-label="Remove image"><X className="h-3 w-3" /></button></div>}
          <textarea className="w-full resize-none border-0 bg-transparent focus:ring-0" rows={2} maxLength={2000} placeholder="Ask for a timeline, budget ideas, a theme…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }} />
        </div>
        <Button loading={send.isPending} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function describe(a: Action, cur: string): string {
  switch (a.tool) {
    case "create_task": return `Add task “${a.args.title}” (${a.args.daysBeforeEvent !== undefined ? `T-${a.args.daysBeforeEvent}` : a.args.dueDate}${a.args.dependsOn.length ? `, after ${a.args.dependsOn.join(", ")}` : ""})`;
    case "shift_schedule": return `Shift task “${a.args.taskId}” by ${a.args.days > 0 ? "+" : ""}${a.args.days} days${a.args.reason ? ` — ${a.args.reason}` : ""}`;
    case "add_budget_item": return `Add budget item “${a.args.name}” — ${fmtMoney2(a.args.unitCost, cur)} × ${a.args.quantity}${a.args.perGuest ? " per guest" : ""} (${a.args.category})`;
    case "save_theme": return `Save theme palette (${a.args.palette.colors.length} colours)`;
  }
}

function ProposalBanner({ p, currency, busy, onDecide }: { p: Proposal; currency: string; busy: boolean; onDecide: (d: "accept" | "reject") => void }) {
  return (
    <div className={cn("space-y-2 rounded-lg border p-3", p.state === "pending" ? "border-brand bg-brand-soft" : "border-line opacity-80")} role="region" aria-label="Proposed changes">
      <p className="font-medium">{p.summary}</p>
      <ul className="max-h-48 list-disc space-y-0.5 overflow-auto pl-5 text-xs">{p.actions.map((a, i) => <li key={i}>{describe(a, currency)}</li>)}</ul>
      {p.state === "pending" ? (
        <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => onDecide("accept")}><Check className="h-4 w-4" /> Accept</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("reject")}><X className="h-4 w-4" /> Reject</Button></div>
      ) : <Badge tone={p.state === "accepted" ? "ok" : "neutral"}>{p.state}</Badge>}
    </div>
  );
}
