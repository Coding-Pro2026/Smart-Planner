"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/client/api";
import { useEvent } from "@/lib/client/hooks";
import { Badge, Button, Card, ErrorNote, Field, Spinner } from "@/components/ui";

interface Rsvp { id: string; guestName: string; contact: string | null; status: "invited" | "accepted" | "declined" | "maybe"; dietaryRequirements: string | null; seatingTable: string | null }

export default function GuestsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const ev = useEvent(eventId).data?.event;
  const canEdit = ev?.role === "owner" || ev?.role === "editor";
  const q = useQuery({ queryKey: ["rsvps", eventId], queryFn: () => api<{ rsvps: Rsvp[]; counts: Record<string, number> }>(`/events/${eventId}/rsvps`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["rsvps", eventId] });
  const [f, setF] = useState({ guestName: "", contact: "", dietaryRequirements: "" });
  const add = useMutation({ mutationFn: () => api(`/events/${eventId}/rsvps`, { body: { ...f, contact: f.contact || null, dietaryRequirements: f.dietaryRequirements || null } }), onSuccess: () => { setF({ guestName: "", contact: "", dietaryRequirements: "" }); refresh(); } });
  const patch = useMutation({ mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) => api(`/events/${eventId}/rsvps/${id}`, { method: "PATCH", body: b }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api(`/events/${eventId}/rsvps/${id}`, { method: "DELETE" }), onSuccess: refresh });
  if (q.isLoading) return <Spinner />;
  const c = q.data?.counts ?? {};
  const diets = (q.data?.rsvps ?? []).filter((r) => r.status === "accepted" && r.dietaryRequirements);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3"><Badge tone="ok">{c.accepted ?? 0} accepted</Badge><Badge tone="warn">{c.maybe ?? 0} maybe</Badge><Badge tone="bad">{c.declined ?? 0} declined</Badge><Badge>{c.invited ?? 0} awaiting reply</Badge>{diets.length > 0 && <Badge tone="brand">{diets.length} dietary needs</Badge>}</div>
      {canEdit && (
        <Card>
          <form className="grid items-end gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <Field label="Guest"><input className="w-full" required value={f.guestName} onChange={(e) => setF({ ...f, guestName: e.target.value })} /></Field>
            <Field label="Contact"><input className="w-full" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
            <Field label="Dietary"><input className="w-full" value={f.dietaryRequirements} onChange={(e) => setF({ ...f, dietaryRequirements: e.target.value })} /></Field>
            <Button loading={add.isPending}><UserPlus className="h-4 w-4" /> Add guest</Button>
          </form>
          <ErrorNote error={add.error} />
        </Card>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">Guest</th><th>Contact</th><th>Status</th><th>Dietary</th><th>Table</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {q.data?.rsvps.map((r) => (
              <tr key={r.id}>
                <td className="py-1.5">{r.guestName}</td><td className="text-muted">{r.contact}</td>
                <td><select disabled={!canEdit} className="py-1" value={r.status} onChange={(e) => patch.mutate({ id: r.id, status: e.target.value })}>{["invited", "accepted", "maybe", "declined"].map((s) => <option key={s}>{s}</option>)}</select></td>
                <td>{r.dietaryRequirements}</td>
                <td><input disabled={!canEdit} className="w-20 py-1" defaultValue={r.seatingTable ?? ""} maxLength={40} onBlur={(e) => e.target.value !== (r.seatingTable ?? "") && patch.mutate({ id: r.id, seatingTable: e.target.value || null })} aria-label="Table" /></td>
                <td>{canEdit && <Button variant="ghost" size="sm" onClick={() => del.mutate(r.id)} aria-label={`Remove ${r.guestName}`}><Trash2 className="h-4 w-4" /></Button>}</td>
              </tr>
            ))}
            {q.data?.rsvps.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted">No guests yet.</td></tr>}
          </tbody>
        </table>
        <ErrorNote error={patch.error ?? del.error} />
      </Card>
    </div>
  );
}
