import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import type { Insight, ReadinessReport } from '../lib/insights';

const sevStyle: Record<Insight['severity'], { icon: typeof Info; cls: string }> = {
  critical: { icon: AlertOctagon, cls: 'text-rose-600 bg-rose-50' },
  warning: { icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' },
  info: { icon: Info, cls: 'text-sky-600 bg-sky-50' },
  success: { icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50' },
};

export function ReadinessCard({
  report,
  daysToEvent,
  onNavigate,
}: {
  report: ReadinessReport;
  daysToEvent: number;
  onNavigate: (tab: NonNullable<Insight['tab']>) => void;
}) {
  const ring = report.score >= 75 ? '#4A6B53' : report.score >= 50 ? '#B88B4A' : '#C86D51';
  const circumference = 2 * Math.PI * 42;
  return (
    <section
      aria-label="Event readiness"
      className="bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 shadow-sm relative overflow-hidden"
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-[#4A6B53] via-[#B88B4A] to-[#C86D51] absolute top-0 left-0" />
      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex items-center gap-6 md:w-[44%]">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e7e5e4" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={ring}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - report.score / 100)}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono tabular-nums text-stone-900">
                {report.score}
              </span>
              <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                Grade {report.grade}
              </span>
            </div>
          </div>
          <div className="space-y-2 min-w-0 flex-1">
            <span className="text-xs font-bold text-[#4A6B53] inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Event Readiness
            </span>
            <p className="text-xs text-stone-500">
              {daysToEvent > 0 ? `${daysToEvent} days to go` : daysToEvent === 0 ? 'Event day!' : 'Event date passed'}
            </p>
            <ul className="space-y-1.5">
              {report.pillars.map((p) => (
                <li key={p.label} className="flex items-center gap-2 text-[11px]">
                  <span className="w-14 text-stone-500">{p.label}</span>
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#B88B4A] to-[#4A6B53]"
                      style={{ width: `${p.score}%` }}
                    />
                  </div>
                  <span className="font-mono tabular-nums w-7 text-right text-stone-700">{p.score}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-stone-900 mb-3">Smart alerts &amp; next best actions</h2>
          <ul className="space-y-2">
            {report.insights.slice(0, 5).map((i) => {
              const { icon: Icon, cls } = sevStyle[i.severity];
              const body = (
                <>
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-xs font-semibold text-stone-900">{i.title}</span>
                    <span className="block text-[11px] text-stone-500 leading-relaxed">{i.detail}</span>
                  </span>
                  {i.tab && <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
                </>
              );
              return (
                <li key={i.id}>
                  {i.tab ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(i.tab!)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-stone-50 transition-colors"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 p-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
