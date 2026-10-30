"use client";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, KeyRound, LogOut, PartyPopper, Plus, Sparkles, Users } from "lucide-react";
import { api, fmtMoney } from "@/lib/client/api";
import { useEvents, useMe } from "@/lib/client/hooks";
import { Badge, Button, Card, ErrorNote, Field, Spinner } from "@/components/ui";

const TYPES = [{ v: "wedding", l: "Wedding", e: "💍" }, { v: "birthday", l: "Birthday", e: "🎂" }, { v: "community", l: "Community event", e: "🏘️" }] as const;

export default function Home() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const events = useEvents();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", eventType: "wedding" as (typeof TYPES)[number]["v"], date: "", location: "", guestCount: 100, targetBudget: 20000, seedStarterPlan: true });
  const create = useMutation({
    mutationFn: () => api<{ event: { id: string } }>("/events", { body: { ...f, location: f.location || null } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["events"] }); router.push(`/events/${r.event.id}`); },
  });
  const logout = useMutation({ mutationFn: () => api("/auth/logout", { method: "POST", body: {} }), onSuccess: () => { qc.clear(); router.replace("/login"); } });

  if (me.isLoading) return <main className="p-8"><Spinner /></main>;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Sparkles className="h-6 w-6 text-brand" /><h1 className="text-2xl font-bold">PlanGenie</h1></div>
        <div className="flex items-center gap-2 text-sm text-muted">
          {me.data?.user.email}
          <Link href="/settings"><Button variant="outline" size="sm"><KeyRound className="h-4 w-4" /> AI keys</Button></Link>
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your events</h2>
        <Button onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> New event</Button>
      </div>

      {open && (
        <Card>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Field label="Title"><input className="w-full" required maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Priya & Sam's wedding" /></Field>
            <Field label="Type">
              <select className="w-full" value={f.eventType} onChange={(e) => setF({ ...f, eventType: e.target.value as typeof f.eventType })}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.e} {t.l}</option>)}</select>
            </Field>
            <Field label="Event date"><input className="w-full" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Location"><input className="w-full" maxLength={200} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
            <Field label="Guests"><input className="w-full" type="number" min={0} max={100000} value={f.guestCount} onChange={(e) => setF({ ...f, guestCount: Number(e.target.value) })} /></Field>
            <Field label="Target budget"><input className="w-full" type="number" min={0} step="100" value={f.targetBudget} onChange={(e) => setF({ ...f, targetBudget: Number(e.target.value) })} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.seedStarterPlan} onChange={(e) => setF({ ...f, seedStarterPlan: e.target.checked })} /> Start with a ready-made timeline &amp; benchmark budget (no AI key needed)</label>
            <div className="sm:col-span-2 space-y-2"><ErrorNote error={create.error} /><Button loading={create.isPending}>Create event</Button></div>
          </form>
        </Card>
      )}

      {events.isLoading && <Spinner />}
      {events.data?.events.length === 0 && !open && (
        <Card className="py-12 text-center text-muted"><PartyPopper className="mx-auto mb-2 h-8 w-8 text-brand" />No events yet. Create your first one to get a timeline, budget and an AI planning assistant.</Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {events.data?.events.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`}>
            <Card className="h-full transition hover:border-brand">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{e.title}</h3>
                <Badge tone="brand">{e.eventType}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
                <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{e.date}</span>
                <span className="flex items-center gap-1"><Users className="h-4 w-4" />{e.guestCount}</span>
                <span>{fmtMoney(e.targetBudget, e.currency)}</span>
                {e.role && e.role !== "owner" && <Badge>{e.role}</Badge>}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
