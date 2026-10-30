"use client";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DndContext, useDraggable, type DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarPlus, Check, Link2, Wand2, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { useEvent } from "@/lib/client/hooks";
import { dayNumber, addDays } from "@/lib/engine/dates";
import { Badge, Button, Card, ErrorNote, Field, Spinner } from "@/components/ui";

interface Task { id: string; title: string; category: string; startDate: string; dueDate: string; status: "todo" | "in_progress" | "done" | "blocked"; dependencies: string[]; isCriticalPath: boolean; slackDays: number; bufferDays: number }
interface Data { tasks: Task[]; criticalPath: string[]; overrunDays: number; eventDate: string; projectEnd: string }
interface Preview { taskId: string; days: number; changes: { id: string; title: string; fromStart: string; toStart: string }[]; overrunDays: number }

const ROW = 36;
const LABEL_W = 220;

export default function TimelinePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const ev = useEvent(eventId).data?.event;
  const canEdit = ev?.role === "owner" || ev?.role === "editor";
  const q = useQuery({ queryKey: ["tasks", eventId], queryFn: () => api<Data>(`/events/${eventId}/tasks`) });
  const [dayW, setDayW] = useState(8);
  const [preview, setPreview] = useState<Preview | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["tasks", eventId] }); };

  const previewShift = useMutation({
    mutationFn: ({ taskId, days }: { taskId: string; days: number }) => api<Preview>(`/events/${eventId}/tasks/shift`, { body: { taskId, days, preview: true } }).then((r) => ({ ...r, taskId, days })),
    onSuccess: setPreview,
  });
  const applyShift = useMutation({ mutationFn: (p: Preview) => api(`/events/${eventId}/tasks/shift`, { body: { taskId: p.taskId, days: p.days } }), onSuccess: () => { setPreview(null); refresh(); } });
  const patch = useMutation({ mutationFn: ({ id, ...b }: { id: string } & Record<string, unknown>) => api(`/events/${eventId}/tasks/${id}`, { method: "PATCH", body: b }), onSuccess: refresh });
  const seed = useMutation({ mutationFn: () => api(`/events/${eventId}/starter-plan`, { method: "POST", body: {} }), onSuccess: refresh });
  const [form, setForm] = useState({ title: "", category: "general", startDate: "", dueDate: "", dependencies: [] as string[] });
  const add = useMutation({ mutationFn: () => api(`/events/${eventId}/tasks`, { body: form }), onSuccess: () => { setForm({ ...form, title: "", dependencies: [] }); refresh(); } });

  const layout = useMemo(() => {
    const tasks = q.data?.tasks ?? [];
    if (!tasks.length) return null;
    const min = Math.min(...tasks.map((t) => dayNumber(t.startDate)));
    const max = Math.max(dayNumber(q.data!.eventDate), ...tasks.map((t) => dayNumber(t.dueDate))) + 2;
    const idx = new Map(tasks.map((t, i) => [t.id, i]));
    return { min, max, idx, width: (max - min + 1) * dayW };
  }, [q.data, dayW]);

  if (q.isLoading || !ev) return <Spinner />;
  const data = q.data!;

  function onDragEnd(e: DragEndEvent) {
    const days = Math.round(e.delta.x / dayW);
    if (days !== 0) previewShift.mutate({ taskId: String(e.active.id), days });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Timeline</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-bad" /> critical path</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-brand" /> has slack</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-ok" /> done</span>
          <label className="flex items-center gap-2 text-muted">Zoom <input type="range" min={3} max={20} value={dayW} onChange={(e) => setDayW(Number(e.target.value))} aria-label="Zoom" /></label>
        </div>
      </div>

      {data.overrunDays > 0 && <Card className="flex items-center gap-2 border-bad/50 text-sm"><AlertTriangle className="h-4 w-4 text-bad" /> The plan now ends <b>{data.overrunDays} day(s)</b> after the event date ({data.projectEnd}). Tasks on the critical path have no slack.</Card>}

      {preview && (
        <Card className="space-y-3 border-brand" role="alert">
          <p className="text-sm"><b>Move “{data.tasks.find((t) => t.id === preview.taskId)?.title}” by {preview.days > 0 ? "+" : ""}{preview.days} day(s)?</b> This reschedules {preview.changes.length} task{preview.changes.length === 1 ? "" : "s"}{preview.overrunDays > 0 && <span className="text-bad"> and pushes the plan {preview.overrunDays} day(s) past the event</span>}.</p>
          <ul className="max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-xs text-muted">{preview.changes.map((c) => <li key={c.id}>{c.title}: {c.fromStart} → {c.toStart}</li>)}</ul>
          <div className="flex gap-2"><Button size="sm" loading={applyShift.isPending} onClick={() => applyShift.mutate(preview)}><Check className="h-4 w-4" /> Accept</Button><Button size="sm" variant="outline" onClick={() => setPreview(null)}><X className="h-4 w-4" /> Reject</Button></div>
          <ErrorNote error={applyShift.error} />
        </Card>
      )}
      <ErrorNote error={previewShift.error ?? patch.error} />

      {!layout ? (
        <Card className="space-y-3 py-10 text-center">
          <p className="text-muted">No tasks yet.</p>
          {canEdit && <div><Button loading={seed.isPending} onClick={() => seed.mutate()}><Wand2 className="h-4 w-4" /> Generate a starter timeline</Button></div>}
          <ErrorNote error={seed.error} />
        </Card>
      ) : (
        <Card className="overflow-auto p-0">
          <DndContext onDragEnd={onDragEnd}>
            <div className="relative" style={{ width: LABEL_W + layout.width, height: ROW * (data.tasks.length + 1) }}>
              <MonthHeader min={layout.min} max={layout.max} dayW={dayW} />
              {/* event-day marker */}
              <div className="absolute top-0 bottom-0 z-10 w-px bg-bad/70" style={{ left: LABEL_W + (dayNumber(data.eventDate) - layout.min) * dayW }}><span className="absolute -top-0 left-1 whitespace-nowrap text-[10px] font-semibold text-bad">Event day</span></div>
              {/* dependency links */}
              <svg className="pointer-events-none absolute left-0 top-0" width={LABEL_W + layout.width} height={ROW * (data.tasks.length + 1)}>
                {data.tasks.flatMap((t) => t.dependencies.map((d) => {
                  const p = data.tasks.find((x) => x.id === d);
                  if (!p) return null;
                  const x1 = LABEL_W + (dayNumber(p.dueDate) - layout.min + 1) * dayW, y1 = (layout.idx.get(p.id)! + 1) * ROW + ROW / 2;
                  const x2 = LABEL_W + (dayNumber(t.startDate) - layout.min) * dayW, y2 = (layout.idx.get(t.id)! + 1) * ROW + ROW / 2;
                  const mid = Math.max(x1 + 6, x2 - 6);
                  return <path key={`${d}-${t.id}`} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" stroke="currentColor" strokeWidth="1" className={p.isCriticalPath && t.isCriticalPath ? "text-bad" : "text-muted/50"} />;
                }))}
              </svg>
              {data.tasks.map((t, i) => <Row key={t.id} t={t} i={i + 1} min={layout.min} dayW={dayW} draggable={canEdit && t.status !== "done"} />)}
            </div>
          </DndContext>
        </Card>
      )}
      {layout && <p className="text-xs text-muted">Drag a bar left or right to delay / advance a task. You’ll see which downstream tasks move before anything is saved.</p>}

      {layout && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-2">Task</th><th>Start</th><th>Due</th><th>Slack</th><th>Depends on</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              {data.tasks.map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5">{t.title} {t.isCriticalPath && <Badge tone="bad">critical</Badge>}</td>
                  <td>{t.startDate}</td><td>{t.dueDate}</td><td>{t.slackDays}d</td>
                  <td className="max-w-[220px] truncate text-xs text-muted">{t.dependencies.map((d) => data.tasks.find((x) => x.id === d)?.title).filter(Boolean).join(", ") || "—"}</td>
                  <td><select disabled={!canEdit} className="py-1" value={t.status} onChange={(e) => patch.mutate({ id: t.id, status: e.target.value })}>{["todo", "in_progress", "done", "blocked"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {canEdit && (
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><CalendarPlus className="h-4 w-4" /> Add task</h2>
          <form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <div className="sm:col-span-2"><Field label="Title"><input className="w-full" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
            <Field label="Start"><input className="w-full" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, dueDate: form.dueDate || e.target.value })} /></Field>
            <Field label="Due"><input className="w-full" type="date" required min={form.startDate} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
            <div className="sm:col-span-3"><Field label="Depends on" hint="Hold Ctrl/Cmd to select several"><select multiple className="h-24 w-full" value={form.dependencies} onChange={(e) => setForm({ ...form, dependencies: [...e.target.selectedOptions].map((o) => o.value) })}>{data.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field></div>
            <div className="flex items-end"><Button loading={add.isPending}><Link2 className="h-4 w-4" /> Add task</Button></div>
          </form>
          <ErrorNote error={add.error} />
        </Card>
      )}
    </div>
  );
}

function Row({ t, i, min, dayW, draggable }: { t: Task; i: number; min: number; dayW: number; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id, disabled: !draggable });
  const left = LABEL_W + (dayNumber(t.startDate) - min) * dayW;
  const width = Math.max(dayW, (dayNumber(t.dueDate) - dayNumber(t.startDate) + 1) * dayW);
  const snapX = transform ? Math.round(transform.x / dayW) * dayW : 0;
  const shiftDays = transform ? Math.round(transform.x / dayW) : 0;
  const color = t.status === "done" ? "bg-ok" : t.isCriticalPath ? "bg-bad" : "bg-brand";
  return (
    <div className="absolute left-0 right-0 border-b border-line/60" style={{ top: i * ROW, height: ROW }}>
      <div className="sticky left-0 z-20 flex h-full items-center bg-card pr-2 pl-3 text-xs" style={{ width: LABEL_W }}><span className="truncate" title={t.title}>{t.title}</span></div>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        role="button"
        aria-label={`${t.title}: ${t.startDate} to ${t.dueDate}`}
        className={`absolute top-2 z-10 h-5 rounded ${color} ${draggable ? "cursor-grab active:cursor-grabbing" : "opacity-70"} ${isDragging ? "opacity-80 ring-2 ring-fg/40" : ""}`}
        style={{ left, width, transform: `translate3d(${snapX}px,0,0)`, touchAction: "none" }}
      >
        {isDragging && shiftDays !== 0 && <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-fg px-1.5 text-[10px] text-bg">{shiftDays > 0 ? "+" : ""}{shiftDays}d → {addDays(t.dueDate, shiftDays)}</span>}
      </div>
    </div>
  );
}

function MonthHeader({ min, max, dayW }: { min: number; max: number; dayW: number }) {
  const months: { label: string; left: number }[] = [];
  let last = "";
  for (let d = min; d <= max; d++) {
    const iso = new Date(d * 86_400_000).toISOString();
    const key = iso.slice(0, 7);
    if (key !== last) { last = key; months.push({ label: new Date(d * 86_400_000).toLocaleDateString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }), left: LABEL_W + (d - min) * dayW }); }
  }
  return <div className="absolute left-0 right-0 top-0 h-9 border-b border-line bg-brand-soft/50">{months.map((m) => <span key={m.left} className="absolute top-2 border-l border-line pl-1 text-[10px] text-muted" style={{ left: m.left }}>{m.label}</span>)}</div>;
}
