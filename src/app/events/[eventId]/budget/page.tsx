"use client";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { api, cents, fmtMoney } from "@/lib/client/api";
import { useEvent } from "@/lib/client/hooks";
import { calculateEventBudget, type BudgetSummary } from "@/lib/engine/budget";
import { Badge, Button, Card, ErrorNote, Field, Progress, Spinner, sevTone } from "@/components/ui";

interface Item { id: string; name: string; category: string; unitCost: number; quantity: number; taxPct: number; contingencyPct: number; perGuest: boolean; estimatedCost: number; actualCost: number | null; status: string }

export default function BudgetPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const ev = useEvent(eventId).data?.event;
  const canEdit = ev?.role === "owner" || ev?.role === "editor";
  const q = useQuery({ queryKey: ["budget", eventId], queryFn: () => api<{ items: Item[]; summary: BudgetSummary }>(`/events/${eventId}/budget`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["budget", eventId] }); qc.invalidateQueries({ queryKey: ["event", eventId] }); };

  // ── Simulator state: purely client-side, uses the SAME engine as the server ──
  const [guests, setGuests] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [scale, setScale] = useState<Record<string, number>>({});
  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const guestCount = guests ?? ev?.guestCount ?? 0;
  const targetBudget = target ?? ev?.targetBudget ?? 0;
  const cats = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);

  const sim = useMemo(() => {
    try {
      return calculateEventBudget(items.map((i) => ({ name: i.name, category: i.category, unitCost: i.unitCost * ((scale[i.category] ?? 100) / 100), quantity: i.quantity, taxPct: i.taxPct, contingencyPct: i.contingencyPct, perGuest: i.perGuest })), targetBudget, { guestCount });
    } catch {
      return null; // transient invalid input while typing; the saved summary below remains authoritative
    }
  }, [items, scale, guestCount, targetBudget]);
  const dirty = guests !== null || target !== null || Object.keys(scale).length > 0;
  const cur = ev?.currency ?? "USD";

  const applyGuests = useMutation({ mutationFn: () => api(`/events/${eventId}`, { method: "PATCH", body: { guestCount, targetBudget } }), onSuccess: () => { setGuests(null); setTarget(null); refresh(); } });
  const del = useMutation({ mutationFn: (id: string) => api(`/events/${eventId}/budget/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const patch = useMutation({ mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api(`/events/${eventId}/budget/${id}`, { method: "PATCH", body }), onSuccess: refresh });
  const [form, setForm] = useState({ name: "", category: "", unitCost: 0, quantity: 1, taxPct: 0, contingencyPct: 0, perGuest: false });
  const add = useMutation({ mutationFn: () => api(`/events/${eventId}/budget`, { body: form }), onSuccess: () => { setForm({ ...form, name: "", unitCost: 0 }); refresh(); } });

  if (q.isLoading || !ev) return <Spinner />;
  const s = sim;
  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Budget simulator</h2>
          <div className="flex gap-2">
            {dirty && <Button variant="outline" size="sm" onClick={() => { setGuests(null); setTarget(null); setScale({}); }}><RotateCcw className="h-4 w-4" /> Reset</Button>}
            {canEdit && (guests !== null || target !== null) && <Button size="sm" loading={applyGuests.isPending} onClick={() => applyGuests.mutate()}>Save guests &amp; target</Button>}
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={`Guests: ${guestCount}`}><input type="range" className="w-full" min={0} max={Math.max(500, (ev.guestCount || 100) * 3)} value={guestCount} onChange={(e) => setGuests(Number(e.target.value))} /></Field>
          <Field label={`Target budget: ${fmtMoney(targetBudget, cur)}`}><input type="range" className="w-full" min={0} max={Math.max(100000, ev.targetBudget * 3)} step={500} value={targetBudget} onChange={(e) => setTarget(Number(e.target.value))} /></Field>
        </div>
        {s && (
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <div><div className="text-3xl font-bold">{cents(s.grandTotalCents, cur)}</div><div className="text-sm text-muted">projected total · {s.percentUsed ?? 0}% of target</div></div>
              <Badge tone={sevTone(s.severity)}>{s.severity === "over" ? `Over by ${cents(-s.remainingCents, cur)}` : `${cents(s.remainingCents, cur)} left`}</Badge>
            </div>
            <Progress pct={s.percentUsed ?? (s.grandTotalCents > 0 ? 100 : 0)} tone={sevTone(s.severity)} />
            {s.severity === "over" && <p className="flex items-center gap-2 text-sm text-bad"><AlertTriangle className="h-4 w-4" /> This scenario exceeds your budget — trim a category or raise the target.</p>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {s?.categories.map((c) => (
            <div key={c.category} className="space-y-1 rounded-lg border border-line p-3 text-sm">
              <div className="flex justify-between"><b>{c.category}</b><span>{cents(c.totalCents, cur)} <span className="text-muted">({c.sharePct}%)</span></span></div>
              <input type="range" className="w-full" min={50} max={150} step={5} value={scale[c.category] ?? 100} onChange={(e) => setScale({ ...scale, [c.category]: Number(e.target.value) })} aria-label={`Scale ${c.category}`} />
              <div className="text-xs text-muted">Price level {scale[c.category] ?? 100}%</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Line items</h2>
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">Item</th><th>Category</th><th>Unit cost</th><th>Qty</th><th>Tax %</th><th>Cont. %</th><th>Per guest</th><th className="text-right">Estimated</th><th>Actual</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="py-1.5 pr-2">{i.name}</td><td className="pr-2 text-muted">{i.category}</td>
                {(["unitCost", "quantity", "taxPct", "contingencyPct"] as const).map((k) => (
                  <td key={k} className="pr-2"><NumCell disabled={!canEdit} value={i[k]} onCommit={(v) => patch.mutate({ id: i.id, [k]: v })} /></td>
                ))}
                <td><input type="checkbox" disabled={!canEdit} checked={i.perGuest} onChange={(e) => patch.mutate({ id: i.id, perGuest: e.target.checked })} aria-label="Per guest" /></td>
                <td className="text-right font-medium">{fmtMoney(i.estimatedCost, cur)}</td>
                <td className="pl-2"><NumCell disabled={!canEdit} value={i.actualCost ?? 0} onCommit={(v) => patch.mutate({ id: i.id, actualCost: v })} /></td>
                <td>{canEdit && <Button variant="ghost" size="sm" onClick={() => del.mutate(i.id)} aria-label={`Delete ${i.name}`}><Trash2 className="h-4 w-4" /></Button>}</td>
              </tr>
            ))}
          </tbody>
          {q.data && <tfoot><tr className="border-t-2 border-line font-semibold"><td colSpan={7} className="py-2">Total (saved plan)</td><td className="text-right">{cents(q.data.summary.grandTotalCents, cur)}</td><td colSpan={2} /></tr></tfoot>}
        </table>
        <ErrorNote error={patch.error ?? del.error} />
        {canEdit && (
          <form className="mt-4 grid items-end gap-3 sm:grid-cols-4 lg:grid-cols-8" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <div className="sm:col-span-2"><Field label="Name"><input className="w-full" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Category"><input className="w-full" required list="cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /><datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field></div>
            <Field label="Unit cost"><input className="w-full" type="number" min={0} step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} /></Field>
            <Field label="Qty"><input className="w-full" type="number" min={0} step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
            <Field label="Tax %"><input className="w-full" type="number" min={0} max={100} step="0.1" value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: Number(e.target.value) })} /></Field>
            <Field label="Cont. %"><input className="w-full" type="number" min={0} max={100} step="0.1" value={form.contingencyPct} onChange={(e) => setForm({ ...form, contingencyPct: Number(e.target.value) })} /></Field>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={form.perGuest} onChange={(e) => setForm({ ...form, perGuest: e.target.checked })} /> Per guest</label>
            <Button loading={add.isPending}><Plus className="h-4 w-4" /> Add</Button>
          </form>
        )}
        <ErrorNote error={add.error} />
      </Card>
    </div>
  );
}

function NumCell({ value, onCommit, disabled }: { value: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [v, setV] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) { setSeen(value); setV(String(value)); }
  return <input disabled={disabled} className="w-20 px-2 py-1" type="number" min={0} step="any" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n !== value) onCommit(n); else setV(String(value)); }} />;
}
