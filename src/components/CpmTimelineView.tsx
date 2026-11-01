import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ListFilter,
  Plus,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  computeCriticalPath,
  CpmScheduleResult,
  CyclicDependencyError,
} from '../lib/deterministicEngine';
import { EventRecord, TaskRecord, TaskStatus } from '../types/domain';
import { Badge, Button, Card, EmptyState, Field, PageHeader, ProgressBar, cx, focusRing, inputCls } from './ui/kit';

interface CpmTimelineViewProps {
  event: EventRecord;
  cpmResult: CpmScheduleResult;
  onShiftTask: (taskId: string, deltaDays: number) => boolean | void;
  onToggleTaskStatus: (taskId: string, nextStatus: TaskStatus) => void;
  onAddTask: (
    task: Omit<TaskRecord, 'id' | 'event_id' | 'is_critical_path' | 'start_date' | 'due_date'>
  ) => boolean | void;
}

export const CpmTimelineView: React.FC<CpmTimelineViewProps> = ({
  event,
  cpmResult,
  onShiftTask,
  onToggleTaskStatus,
  onAddTask,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [cascadeBanner, setCascadeBanner] = useState<string | null>(null);
  const [showAdvancedDag, setShowAdvancedDag] = useState(false);
  const [cycleTestAlert, setCycleTestAlert] = useState<string | null>(null);

  // New Task Form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Venue & Logistics');
  const [newMilestone, setNewMilestone] = useState('T-30');
  const [newDuration, setNewDuration] = useState('7');
  const [newAssigned, setNewAssigned] = useState('Claire Vance');
  const [selectedDep, setSelectedDep] = useState<string>('');

  // One banner timer at a time; cleared on unmount so a stale timeout never hides a newer message.
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); }, []);
  const flashBanner = (msg: string, ms: number) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setCascadeBanner(msg);
    bannerTimer.current = setTimeout(() => setCascadeBanner(null), ms);
  };

  const totalSpan = Math.max(30, cpmResult.totalProjectDurationDays);

  const handleShiftWithFeedback = (task: TaskRecord, deltaDays: number) => {
    if (onShiftTask(task.id, deltaDays) === false) return;
    const dependentCount = cpmResult.tasks.filter((t) =>
      t.dependencies.includes(task.id)
    ).length;
    const direction =
      deltaDays > 0 ? `delayed by +${deltaDays} days` : `moved ${Math.abs(deltaDays)} days earlier`;
    flashBanner(
      `"${task.title}" was ${direction}. ${
        dependentCount > 0
          ? `Automatically shifted ${dependentCount} connected downstream task(s) to keep your schedule aligned.`
          : 'Schedule updated.'
      }`
      , 5000
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created = onAddTask({
      title: newTitle.trim(),
      category: newCategory.trim() || 'General',
      milestone_code: newMilestone,
      start_day_offset: 0,
      duration_days: Math.max(1, Number(newDuration) || 5),
      buffer_days: 1,
      status: 'todo',
      assigned_to: newAssigned.trim() || 'Claire Vance',
      dependencies: selectedDep ? [selectedDep] : [],
    });

    if (created === false) return; // App already explained why (e.g. circular dependency)
    setNewTitle('');
    setShowNewTaskForm(false);
    flashBanner(`Scheduled new task "${newTitle.trim()}" and linked it to your timeline.`, 4000);
  };

  const handleRunCycleGuardDemo = () => {
    try {
      const cloned = cpmResult.tasks.map((t) => ({ ...t, dependencies: [...t.dependencies] }));
      if (cloned.length >= 2) {
        const first = cloned[0];
        const last = cloned[cloned.length - 1];
        first.dependencies.push(last.id);
        computeCriticalPath(cloned, event.kickoff_date);
      }
    } catch (err) {
      if (err instanceof CyclicDependencyError) {
        setCycleTestAlert(
          `Verified: Prevented circular dependency loop between [${err.involvedTaskIds.join(' → ')}].`
        );
      }
    }
  };

  const filteredTasks =
    statusFilter === 'ALL'
      ? cpmResult.tasks
      : cpmResult.tasks.filter((t) => t.status === statusFilter);

  const completedCount = cpmResult.tasks.filter((t) => t.status === 'completed').length;

  const filters = [
    ['ALL', `All (${cpmResult.tasks.length})`],
    ['in_progress', 'In progress'],
    ['todo', 'To do'],
    ['delayed', 'Delayed'],
    ['completed', `Done (${completedCount})`],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CalendarClock className="h-4 w-4" />}
        eyebrow="Schedule"
        title="Event schedule & timeline"
        description="Check off tasks, add milestones or reschedule items. Connected tasks adjust automatically."
        stat={{ value: `${completedCount}/${cpmResult.tasks.length}`, label: `done · ${cpmResult.totalProjectDurationDays}-day span` }}
        actions={
          <Button variant="primary" aria-expanded={showNewTaskForm} aria-controls="new-task-form" onClick={() => setShowNewTaskForm((prev) => !prev)}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            {showNewTaskForm ? 'Close form' : 'Schedule new task'}
          </Button>
        }
      >
        <ProgressBar value={cpmResult.tasks.length ? (completedCount / cpmResult.tasks.length) * 100 : 0} label="Tasks completed" />
      </PageHeader>

      <div role="status" aria-live="polite">
        {cascadeBanner && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#C9DDCF] bg-[#EEF4EF] p-4 text-sm text-[#2F4A38] dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            <span className="flex items-center gap-3">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
              {cascadeBanner}
            </span>
            <Button variant="ghost" className="!h-8 shrink-0" onClick={() => setCascadeBanner(null)}>
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {showNewTaskForm && (
        <Card as="div" className="p-6">
          <form id="new-task-form" onSubmit={handleCreateTask} className="space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold leading-6 text-stone-900">Schedule a new task</h3>
              <p className="text-sm text-stone-600">Dates are calculated from your start date ({event.kickoff_date}).</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="What needs to be done?" className="lg:col-span-2">
                <input
                  type="text"
                  required
                  maxLength={120}
                  autoFocus
                  placeholder="e.g. Finalize cake tasting"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Happens after (optional)">
                <select value={selectedDep} onChange={(e) => setSelectedDep(e.target.value)} className={inputCls}>
                  <option value="">Can start immediately</option>
                  {cpmResult.tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      After: {t.title.slice(0, 30)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Days to complete">
                <input type="number" min={1} max={90} value={newDuration} onChange={(e) => setNewDuration(e.target.value)} className={cx(inputCls, 'font-mono tabular-nums')} />
              </Field>
              <Field label="Assigned to">
                <input type="text" maxLength={60} value={newAssigned} onChange={(e) => setNewAssigned(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button onClick={() => setShowNewTaskForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary">
                Add to schedule
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Filter tasks by status" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
          {filters.map(([st, label]) => (
            <button
              key={st}
              type="button"
              aria-pressed={statusFilter === st}
              onClick={() => setStatusFilter(st as 'ALL' | TaskStatus)}
              className={cx(
                'h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-[background-color,box-shadow,color] motion-reduce:transition-none',
                statusFilter === st ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-700 hover:text-stone-900',
                focusRing
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-stone-600" aria-live="polite">
          Showing <span className="font-mono tabular-nums text-stone-900">{filteredTasks.length}</span> of {cpmResult.tasks.length}
        </p>
      </div>

      {cpmResult.tasks.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-5 w-5" />}
          title="No tasks yet"
          body="Schedule your first task and we'll calculate dates and the critical path."
          action={<Button variant="primary" onClick={() => setShowNewTaskForm(true)}>Schedule new task</Button>}
        />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={<ListFilter className="h-5 w-5" />}
          title="No tasks match this filter"
          body="Try a different status to see the rest of your schedule."
          action={<Button onClick={() => setStatusFilter('ALL')}>Show all tasks</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {filteredTasks.map((task) => {
            const isDone = task.status === 'completed';
            const es = task.early_start ?? 0;
            const ef = task.early_finish ?? es + task.duration_days;
            const leftPct = Math.min(90, Math.round((es / totalSpan) * 100));
            const widthPct = Math.max(8, Math.min(100 - leftPct, Math.round(((ef - es) / totalSpan) * 100)));
            const depTitles = task.dependencies.map((depId) => cpmResult.tasks.find((t) => t.id === depId)?.title).filter(Boolean);

            return (
              <li key={task.id}>
                <Card as="article" interactive className={cx('p-5', isDone && 'bg-stone-50')}>
                  <div className="grid grid-cols-1 items-center gap-5 xl:grid-cols-12">
                    <div className="flex items-start gap-3 xl:col-span-5">
                      <label className="group -m-1.5 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center">
                        <input type="checkbox" className="peer sr-only" checked={isDone} onChange={() => onToggleTaskStatus(task.id, isDone ? 'todo' : 'completed')} />
                        <span
                          aria-hidden="true"
                          className="flex h-5 w-5 items-center justify-center rounded-md border border-stone-400 bg-white text-white transition-colors group-hover:border-[#3B5943] peer-checked:border-[#3B5943] peer-checked:bg-[#3B5943] peer-focus-visible:ring-2 peer-focus-visible:ring-[#4A6B53] peer-focus-visible:ring-offset-2"
                        >
                          <Check className={cx('h-3.5 w-3.5 transition-opacity', isDone ? 'opacity-100' : 'opacity-0')} />
                        </span>
                        <span className="sr-only">{`Mark "${task.title}" as ${isDone ? 'not done' : 'done'}`}</span>
                      </label>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={cx('text-sm font-semibold leading-5', isDone ? 'text-stone-500 line-through' : 'text-stone-900')}>{task.title}</h3>
                          {task.is_critical_path && !isDone && <Badge tone="warn">Critical path</Badge>}
                          {task.status === 'delayed' && <Badge tone="bad">Delayed</Badge>}
                        </div>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 text-stone-600">
                          <span>{task.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <User aria-hidden="true" className="h-3.5 w-3.5" />
                            {task.assigned_to}
                          </span>
                        </p>
                        <p className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-stone-700">
                          <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
                          {task.start_date} <ArrowRight aria-hidden="true" className="h-3 w-3" /> {task.due_date}
                        </p>
                        {depTitles.length > 0 && (
                          <p className="text-sm leading-5 text-stone-600">
                            Starts after <span className="font-medium text-stone-800">{depTitles.join(', ')}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 xl:col-span-4">
                      <div className="flex items-center justify-between text-xs text-stone-600">
                        <span className="inline-flex items-center gap-1">
                          <Clock aria-hidden="true" className="h-3.5 w-3.5" /> {task.duration_days} days
                        </span>
                        <span>{task.is_critical_path ? 'No buffer' : `${task.slack_days ?? 0}d buffer`}</span>
                      </div>
                      <div
                        role="img"
                        aria-label={`Runs from day ${es} to day ${ef} of ${totalSpan}`}
                        className="relative h-6 overflow-hidden rounded-lg bg-stone-100"
                      >
                        <div
                          className={cx(
                            'absolute bottom-1 top-1 rounded-md transition-[left,width] duration-300 motion-reduce:transition-none',
                            isDone ? 'bg-[#4A6B53]' : task.is_critical_path ? 'bg-amber-600' : 'bg-stone-500'
                          )}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:col-span-3 xl:justify-end">
                      <Button className="!h-8 !px-3" onClick={() => handleShiftWithFeedback(task, -3)} aria-label={`3d earlier: ${task.title}`}>
                        3d earlier
                      </Button>
                      <Button className="!h-8 !px-3" onClick={() => handleShiftWithFeedback(task, 7)} aria-label={`+1 wk: ${task.title}`}>
                        +1 wk
                      </Button>
                      <Button className="!h-8 !px-3" onClick={() => handleShiftWithFeedback(task, 14)} aria-label={`+2 wks: ${task.title}`}>
                        +2 wks
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <button
          type="button"
          aria-expanded={showAdvancedDag}
          aria-controls="dag-details"
          onClick={() => setShowAdvancedDag((prev) => !prev)}
          className={cx('inline-flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-stone-700 hover:text-stone-900', focusRing)}
        >
          {showAdvancedDag ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
          {showAdvancedDag ? 'Hide' : 'Show'} critical-path details
        </button>
        {showAdvancedDag && (
          <Card as="div" className="mt-3 flex flex-wrap items-center justify-between gap-4 p-4" id="dag-details">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-stone-900">Critical path & loop protection</p>
              <p className="text-sm text-stone-600">
                {cpmResult.bottleneckCount} critical milestones · {cpmResult.totalProjectDurationDays}-day span. Circular dependencies are blocked automatically.
              </p>
              {cycleTestAlert && (
                <p role="status" className="font-mono text-xs text-[#2F4A38] dark:text-emerald-300">
                  {cycleTestAlert}
                </p>
              )}
            </div>
            <Button onClick={handleRunCycleGuardDemo}>
              <ShieldAlert aria-hidden="true" className="h-4 w-4 text-amber-700" />
              Test loop protection
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
