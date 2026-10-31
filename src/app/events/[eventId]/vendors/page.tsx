"use client";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FileUp, GitCompare, ShieldAlert, Trash2 } from "lucide-react";
import { api, cents, fmtMoney } from "@/lib/client/api";
import { useEvent } from "@/lib/client/hooks";
import type { QuoteComparison } from "@/lib/engine/quotes";
import type { QuoteTerms } from "@/lib/documents/quote-schema";
import { QuoteMatrix } from "@/components/event/quote-matrix";
import { Badge, Button, Card, ErrorNote, Field, Modal, Spinner } from "@/components/ui";

interface Vendor { id: string; name: string; serviceType: string; quoteAmount: number | null; status: string; parsedTerms: { terms?: QuoteTerms; computed?: { totalCents: number; warnings: string[] } } | null }

export default function VendorsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const ev = useEvent(eventId).data?.event;
  const canEdit = ev?.role === "owner" || ev?.role === "editor";
  const cur = ev?.currency ?? "USD";
  const q = useQuery({ queryKey: ["vendors", eventId], queryFn: () => api<{ vendors: Vendor[] }>(`/events/${eventId}/vendors`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["vendors", eventId] });
  // "In budget" is derived from the saved budget (survives reloads and other collaborators' actions).
  const budget = useQuery({ queryKey: ["budget", eventId], queryFn: () => api<{ items: { vendorId: string | null }[] }>(`/events/${eventId}/budget`) });
  const inBudget = new Set((budget.data?.items ?? []).map((i) => i.vendorId).filter(Boolean));
  const fileRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState({ name: "", serviceType: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [cmp, setCmp] = useState<{ comparison: QuoteComparison; terms: Record<string, QuoteTerms> } | null>(null);

  const upload = useMutation({
    mutationFn: () => {
      const f = fileRef.current?.files?.[0];
      if (!f) throw new Error("Choose a PDF or image first");
      const form = new FormData();
      form.set("file", f); form.set("name", meta.name); form.set("serviceType", meta.serviceType);
      return api<{ computed: { totalCents: number } }>(`/events/${eventId}/vendors/upload`, { form, llm: true });
    },
    onSuccess: () => { setMeta({ name: "", serviceType: "" }); if (fileRef.current) fileRef.current.value = ""; refresh(); },
  });
  const compare = useMutation({ mutationFn: () => api<{ comparison: QuoteComparison; terms: Record<string, QuoteTerms> }>(`/events/${eventId}/vendors/compare`, { body: { vendorIds: picked } }), onSuccess: setCmp });
  const patch = useMutation({ mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) => api(`/events/${eventId}/vendors/${id}`, { method: "PATCH", body: b }), onSuccess: refresh });
  const toBudget = useMutation({ mutationFn: (id: string) => api(`/events/${eventId}/vendors/${id}/to-budget`, { method: "POST", body: {} }), onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", eventId] }) });
  const del = useMutation({ mutationFn: (id: string) => api(`/events/${eventId}/vendors/${id}`, { method: "DELETE" }), onSuccess: () => { refresh(); setPicked([]); } });
  const [manual, setManual] = useState({ name: "", serviceType: "" });
  const addManual = useMutation({ mutationFn: () => api(`/events/${eventId}/vendors`, { body: manual }), onSuccess: () => { setManual({ name: "", serviceType: "" }); refresh(); } });

  if (q.isLoading) return <Spinner />;
  const vendors = q.data?.vendors ?? [];
  const parsed = vendors.filter((v) => v.parsedTerms?.terms);

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FileUp className="h-5 w-5 text-brand" /> Upload a vendor quote (PDF or photo)</h2>
          <p className="text-sm text-muted">The AI extracts line items, hidden fees, payment schedule and risky clauses. Every total is then recalculated by code — never trusted from the model. Requires an AI key in <Link href="/settings" className="text-brand underline">settings</Link>.</p>
          <form className="grid items-end gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}>
            <Field label="Vendor name (optional)"><input className="w-full" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
            <Field label="Service type"><input className="w-full" placeholder="Catering" value={meta.serviceType} onChange={(e) => setMeta({ ...meta, serviceType: e.target.value })} /></Field>
            <Field label="PDF / image"><input ref={fileRef} className="w-full text-xs" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required /></Field>
            <Button loading={upload.isPending}>{upload.isPending ? "Reading quote…" : "Analyse quote"}</Button>
          </form>
          {upload.isPending && <Spinner label="Extracting terms and recalculating totals — this can take up to a minute…" />}
          {upload.isSuccess && <p className="text-sm text-ok">Parsed — all-in total {cents(upload.data.computed.totalCents, cur)}.</p>}
          <ErrorNote error={upload.error} />
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Vendors</h2>
        <Button disabled={picked.length < 2} loading={compare.isPending} onClick={() => compare.mutate()}><GitCompare className="h-4 w-4" /> Compare {picked.length >= 2 ? `(${picked.length})` : ""}</Button>
      </div>
      <ErrorNote error={compare.error ?? patch.error ?? del.error ?? toBudget.error} />
      {vendors.length === 0 && <Card className="py-8 text-center text-muted">No vendors yet.</Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {vendors.map((v) => {
          const risks = v.parsedTerms?.terms?.riskClauses.filter((r) => r.severity === "high").length ?? 0;
          const isParsed = !!v.parsedTerms?.terms;
          return (
            <Card key={v.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold">{v.name}</h3><p className="text-xs text-muted">{v.serviceType}</p></div>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={!isParsed} checked={picked.includes(v.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, v.id].slice(-6) : picked.filter((x) => x !== v.id))} /> compare</label>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xl font-bold">{v.quoteAmount == null ? "—" : fmtMoney(v.quoteAmount, cur)}</span>
                {isParsed && <Badge tone="brand">parsed</Badge>}
                {risks > 0 && <Badge tone="bad"><ShieldAlert className="mr-1 h-3 w-3" />{risks} high risk</Badge>}
              </div>
              {v.parsedTerms?.computed?.warnings.map((w) => <p key={w} className="text-xs text-warn">{w}</p>)}
              <div className="flex items-center justify-between">
                <select disabled={!canEdit} className="py-1 text-xs" value={v.status} onChange={(e) => patch.mutate({ id: v.id, status: e.target.value })}>{["researching", "quoted", "booked", "rejected"].map((s) => <option key={s}>{s}</option>)}</select>
                {canEdit && v.quoteAmount != null && v.status !== "rejected" && (inBudget.has(v.id)
                  ? <Badge tone="ok">In budget ✓</Badge>
                  : <Button variant="outline" size="sm" loading={toBudget.isPending && toBudget.variables === v.id} onClick={() => toBudget.mutate(v.id)}>Add to budget</Button>)}
                {canEdit && <Button variant="ghost" size="sm" onClick={() => del.mutate(v.id)} aria-label={`Delete ${v.name}`}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </Card>
          );
        })}
      </div>
      {parsed.length === 1 && <p className="text-xs text-muted">Upload a second quote to compare vendors side by side.</p>}

      {canEdit && (
        <Card>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); addManual.mutate(); }}>
            <Field label="Add vendor manually"><input className="w-56" required placeholder="Name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} /></Field>
            <input className="w-44" required placeholder="Service (e.g. Florist)" value={manual.serviceType} onChange={(e) => setManual({ ...manual, serviceType: e.target.value })} aria-label="Service type" />
            <Button variant="outline" loading={addManual.isPending}>Add</Button>
          </form>
          <ErrorNote error={addManual.error} />
        </Card>
      )}

      <Modal open={!!cmp} onClose={() => setCmp(null)} title="Quote comparison" wide>
        {cmp && <QuoteMatrix comparison={cmp.comparison} terms={cmp.terms} currency={cur} />}
      </Modal>
    </div>
  );
}
