import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
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

interface CpmTimelineViewProps {
  event: EventRecord;
  cpmResult: CpmScheduleResult;
  onShiftTask: (taskId: string, deltaDays: number) => void;
  onToggleTaskStatus: (taskId: string, nextStatus: TaskStatus) => void;
  onAddTask: (
    task: Omit<TaskRecord, 'id' | 'event_id' | 'is_critical_path' | 'start_date' | 'due_date'>
  ) => void;
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

  const totalSpan = Math.max(30, cpmResult.totalProjectDurationDays);

  const handleShiftWithFeedback = (task: TaskRecord, deltaDays: number) => {
    onShiftTask(task.id, deltaDays);
    const dependentCount = cpmResult.tasks.filter((t) =>
      t.dependencies.includes(task.id)
    ).length;
    const direction =
      deltaDays > 0 ? `delayed by +${deltaDays} days` : `moved ${Math.abs(deltaDays)} days earlier`;
    setCascadeBanner(
      `"${task.title}" was ${direction}. ${
        dependentCount > 0
          ? `Automatically shifted ${dependentCount} connected downstream task(s) to keep your schedule aligned.`
          : 'Schedule updated.'
      }`
    );
    setTimeout(() => setCascadeBanner(null), 5000);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddTask({
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

    setNewTitle('');
    setShowNewTaskForm(false);
    setCascadeBanner(`Scheduled new task "${newTitle.trim()}" and linked it to your timeline.`);
    setTimeout(() => setCascadeBanner(null), 4000);
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

  return (
    <div className="space-y-6">
      {/* Clean Header & Prominent "+ Schedule New Task" Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Event Schedule &amp; Timeline</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Check off tasks, add new milestones, or reschedule items — connected tasks adjust automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewTaskForm((prev) => !prev)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-2xs whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {showNewTaskForm ? 'Close Task Form' : 'Schedule New Task'}
        </button>
      </div>

      {/* Friendly Auto-Cascade Notification Banner */}
      {cascadeBanner && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-center justify-between gap-4 text-xs font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{cascadeBanner}</span>
          </div>
          <button
            onClick={() => setCascadeBanner(null)}
            className="text-indigo-600 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Clean Quick-Add Task Card */}
      {showNewTaskForm && (
        <form
          onSubmit={handleCreateTask}
          className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h2 className="text-base font-bold text-stone-900">Schedule a New Task</h2>
            <span className="text-xs text-stone-500">
              Dates are calculated automatically from your start date ({event.kickoff_date})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                What needs to be done?
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Finalize Cake Tasting or Send Save-the-Dates"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Happens After (Optional)
              </label>
              <select
                value={selectedDep}
                onChange={(e) => setSelectedDep(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white"
              >
                <option value="">Can start immediately</option>
                {cpmResult.tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    After: {t.title.slice(0, 30)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                How many days will it take?
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Assigned To
              </label>
              <input
                type="text"
                value={newAssigned}
                onChange={(e) => setNewAssigned(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowNewTaskForm(false)}
              className="px-4 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl"
            >
              Add to Schedule
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar & Progress Summary */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
          {(
            [
              ['ALL', `All Tasks (${cpmResult.tasks.length})`],
              ['in_progress', 'In Progress'],
              ['todo', 'To Do'],
              ['completed', `Completed (${completedCount})`],
            ] as const
          ).map(([st, label]) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st as 'ALL' | TaskStatus)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="text-xs text-stone-500">
          <span>Total Timeline Span: </span>
          <strong className="font-mono text-stone-900">
            {cpmResult.totalProjectDurationDays} days
          </strong>
          <span aria-hidden="true"> · </span>
          <span>
            {completedCount} of {cpmResult.tasks.length} tasks completed
          </span>
        </div>
      </div>

      {/* Clean, Easy-to-Scan Task Cards */}
      <div className="space-y-3">
        {filteredTasks.map((task) => {
          const isDone = task.status === 'completed';
          const es = task.early_start ?? 0;
          const ef = task.early_finish ?? es + task.duration_days;
          const leftPct = Math.min(90, Math.round((es / totalSpan) * 100));
          const widthPct = Math.max(
            8,
            Math.min(100 - leftPct, Math.round(((ef - es) / totalSpan) * 100))
          );

          const depTitles = task.dependencies
            .map((depId) => cpmResult.tasks.find((t) => t.id === depId)?.title)
            .filter(Boolean);

          return (
            <div
              key={task.id}
              className={`bg-white border rounded-2xl p-5 transition-all shadow-2xs ${
                isDone
                  ? 'border-stone-200/70 bg-stone-50/40'
                  : 'border-stone-200/90 hover:border-stone-300'
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* Left 5 cols: Checkbox + Title + Plain-English Details */}
                <div className="lg:col-span-5 flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      onToggleTaskStatus(task.id, isDone ? 'todo' : 'completed')
                    }
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                      isDone
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-stone-300 hover:border-indigo-600 bg-white'
                    }`}
                    title={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                  >
                    {isDone && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-sm font-semibold ${
                          isDone ? 'line-through text-stone-400' : 'text-stone-900'
                        }`}
                      >
                        {task.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                      <span>{task.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-stone-400" />
                        {task.assigned_to}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-mono text-stone-700">
                        <Calendar className="w-3 h-3 text-stone-400" />
                        {task.start_date} <ArrowRight className="w-3 h-3 inline" /> {task.due_date}
                      </span>
                    </div>

                    {depTitles.length > 0 && (
                      <div className="text-xs text-stone-500 pt-0.5">
                        Starts after: <span className="text-stone-700 font-medium">{depTitles.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle 4 cols: Clean Visual Timeline Bar */}
                <div className="lg:col-span-4 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {task.duration_days} days
                    </span>
                    <span className="font-mono">
                      {task.is_critical_path ? 'Key Milestone' : `${task.slack_days ?? 0}d flexible buffer`}
                    </span>
                  </div>
                  <div className="relative h-6 bg-stone-100 rounded-lg overflow-hidden">
                    <div
                      className={`absolute top-1 bottom-1 rounded-md transition-all duration-150 ${
                        isDone
                          ? 'bg-emerald-500'
                          : task.is_critical_path
                          ? 'bg-indigo-600'
                          : 'bg-stone-400'
                      }`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Right 3 cols: Simple Reschedule Controls */}
                <div className="lg:col-span-3 flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleShiftWithFeedback(task, -3)}
                    className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap"
                    title="Move task 3 days earlier"
                  >
                    3d Earlier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftWithFeedback(task, 7)}
                    className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors whitespace-nowrap"
                    title="Delay by 1 week and auto-shift connected tasks"
                  >
                    Delay 1 Wk
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftWithFeedback(task, 14)}
                    className="px-3 py-1.5 text-xs font-medium text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors whitespace-nowrap"
                    title="Delay by 2 weeks and auto-shift connected tasks"
                  >
                    Delay 2 Wks
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Progressive Disclosure for Advanced DAG / Cycle Guard */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowAdvancedDag((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          {showAdvancedDag ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Hide Technical Critical Path (DAG) Details
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Show Technical Critical Path (DAG) &amp; Loop Protection
            </>
          )}
        </button>

        {showAdvancedDag && (
          <div className="mt-3 p-4 bg-white border border-stone-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-stone-900">
                Directed Acyclic Graph (DAG) Topological Sort &amp; Cycle Protection
              </div>
              <p className="text-stone-500">
                Critical Path Milestones: {cpmResult.bottleneckCount} · Total Span:{' '}
                {cpmResult.totalProjectDurationDays} days. Circular dependencies are automatically blocked.
              </p>
              {cycleTestAlert && (
                <p className="text-emerald-700 font-mono pt-1">{cycleTestAlert}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleRunCycleGuardDemo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl whitespace-nowrap"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Test Circular Dependency Protection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
