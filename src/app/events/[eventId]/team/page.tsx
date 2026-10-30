"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/client/api";
import { useEvent } from "@/lib/client/hooks";
import { Badge, Button, Card, ErrorNote, Field, Spinner } from "@/components/ui";

export default function TeamPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const ev = useEvent(eventId).data?.event;
  const isOwner = ev?.role === "owner";
  const q = useQuery({ queryKey: ["collabs", eventId], queryFn: () => api<{ collaborators: { id: string; email: string; role: string }[] }>(`/events/${eventId}/collaborators`) });
  const logs = useQuery({ queryKey: ["audit", eventId], queryFn: () => api<{ logs: { id: string; action: string; timestamp: string; metadata: unknown }[] }>(`/events/${eventId}/audit`), enabled: isOwner });
  const refresh = () => qc.invalidateQueries({ queryKey: ["collabs", eventId] });
  const [f, setF] = useState({ email: "", role: "editor" });
  const add = useMutation({ mutationFn: () => api(`/events/${eventId}/collaborators`, { body: f }), onSuccess: () => { setF({ ...f, email: "" }); refresh(); } });
  const del = useMutation({ mutationFn: (id: string) => api(`/events/${eventId}/collaborators/${id}`, { method: "DELETE" }), onSuccess: refresh });
  if (q.isLoading) return <Spinner />;
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 font-semibold">People</h2>
        <ul className="divide-y divide-line">
          {q.data?.collaborators.map((c) => <li key={c.id} className="flex items-center justify-between py-2 text-sm"><span>{c.email} <Badge tone={c.role === "owner" ? "brand" : "neutral"}>{c.role}</Badge></span>{isOwner && c.role !== "owner" && <Button variant="ghost" size="sm" onClick={() => del.mutate(c.id)} aria-label={`Remove ${c.email}`}><Trash2 className="h-4 w-4" /></Button>}</li>)}
        </ul>
        {isOwner && (
          <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <Field label="Invite by email" hint="They need a PlanGenie account first."><input className="w-64" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Role"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="editor">Editor — can change everything</option><option value="viewer">Viewer — read only</option><option value="vendor">Vendor — timeline only</option></select></Field>
            <Button loading={add.isPending}>Add</Button>
          </form>
        )}
        <ErrorNote error={add.error ?? del.error} />
      </Card>
      {isOwner && (
        <Card>
          <h2 className="mb-3 font-semibold">Activity</h2>
          <ul className="max-h-80 space-y-1 overflow-auto text-xs text-muted">{logs.data?.logs.map((l) => <li key={l.id}><span className="tabular-nums">{new Date(l.timestamp).toLocaleString()}</span> · <b className="text-fg">{l.action}</b></li>)}</ul>
        </Card>
      )}
    </div>
  );
}
