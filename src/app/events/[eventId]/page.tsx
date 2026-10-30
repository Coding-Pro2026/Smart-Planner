"use client";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckSquare, Flame, Users, Wallet } from "lucide-react";
import { api, fmtMoney } from "@/lib/client/api";
import { useEvent } from "@/lib/client/hooks";
import type { BudgetSummary } from "@/lib/engine/budget";
import { Badge, Card, Progress, Spinner, sevTone } from "@/components/ui";

interface Task { id: string; title: string; dueDate: string; status: string; isCriticalPath: boolean }

export default function Dashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const ev = useEvent(eventId).data?.event;
  const role = ev?.role;
  const full = role !== "vendor";
  const budget = useQuery({ queryKey: ["budget", eventId], queryFn: () => api<{ summary: BudgetSummary }>(`/events/${eventId}/budget`), enabled: full && !!ev });
  const tasks = useQuery({ queryKey: ["tasks", eventId], queryFn: () => api<{ tasks: Task[]; criticalPath: string[]; overrunDays: number }>(`/events/${eventId}/tasks`), enabled: !!ev });
  const rsvps = useQuery({ queryKey: ["rsvps", eventId], queryFn: () => api<{ counts: Record<string, number>; rsvps: unknown[] }>(`/events/${eventId}/rsvps`), enabled: full && !!ev });
  if (!ev) return <Spinner />;

  const days = Math.ceil((Date.parse(`${ev.date}T00:00:00Z`) - Date.now()) / 86_400_000);
  const s = budget.data?.summary;
  const done = tasks.data?.tasks.filter((t) => t.status === "done").length ?? 0;
  const total = tasks.data?.tasks.length ?? 0;
  const next = tasks.data?.tasks.filter((t) => t.status !== "done").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{ev.title}</h1>
        <p className="text-sm text-muted">{ev.date}{ev.location ? ` · ${ev.location}` : ""} · {ev.guestCount} guests</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={CalendarClock} label="Days to event" value={days >= 0 ? String(days) : "Past"} sub={days < 0 ? `${-days} days ago` : days <= 30 ? "Crunch time" : "On the calendar"} />
        {full && <Kpi icon={Wallet} label="Budget burn" value={s?.percentUsed == null ? "—" : `${s.percentUsed}%`} sub={s ? `${fmtMoney(s.grandTotalCents / 100, ev.currency)} of ${fmtMoney(ev.targetBudget, ev.currency)}` : ""}>
          {s && <Progress pct={s.percentUsed ?? 0} tone={sevTone(s.severity)} />}
        </Kpi>}
        {full && <Kpi icon={Users} label="RSVPs" value={String(rsvps.data?.counts.accepted ?? 0)} sub={`accepted · ${rsvps.data?.rsvps.length ?? 0} invited · ${rsvps.data?.counts.declined ?? 0} declined`} />}
        <Kpi icon={CheckSquare} label="Tasks done" value={`${done}/${total}`} sub={total ? `${Math.round((done / total) * 100)}% complete` : "No tasks yet"}>
          <Progress pct={total ? (done / total) * 100 : 0} tone="ok" />
        </Kpi>
      </div>

      {s && s.alerts.length > 0 && (
        <Card className="border-warn/50">
          {s.alerts.map((a, i) => <p key={i} className="text-sm"><Badge tone={sevTone(a.severity === "over" ? "over" : "warning")}>{a.severity === "over" ? "Over budget" : "Near limit"}</Badge> {a.scope === "total" ? "Overall plan" : a.category}{a.overByCents > 0 && <> is over by <b>{fmtMoney(a.overByCents / 100, ev.currency)}</b></>}</p>)}
        </Card>
      )}
      {tasks.data && tasks.data.overrunDays > 0 && (
        <Card className="border-bad/50"><p className="flex items-center gap-2 text-sm"><Flame className="h-4 w-4 text-bad" /> The current timeline runs <b>{tasks.data.overrunDays} day(s)</b> past the event date. Review the critical path on the Timeline tab.</p></Card>
      )}

      {ev.theme && (
        <Card className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">{ev.theme.colors.map((c) => <div key={c.hex} className="text-center text-[10px] text-muted"><div className="h-9 w-9 rounded-lg border border-line" style={{ background: c.hex }} title={c.name} />{c.hex}</div>)}</div>
          <p className="min-w-[200px] flex-1 text-sm text-muted">{ev.theme.summary}</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">Up next</h2>
        {next.length === 0 ? <p className="text-sm text-muted">Nothing pending.</p> : (
          <ul className="divide-y divide-line">
            {next.map((t) => <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{t.title}</span><span className="flex items-center gap-2 text-muted">{t.isCriticalPath && <Badge tone="bad">critical</Badge>}{t.dueDate}</span></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, children }: { icon: typeof Wallet; label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted"><Icon className="h-4 w-4" />{label}</div>
      <div className="text-3xl font-bold">{value}</div>
      {children}
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}
