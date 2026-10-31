import { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { loadJson, saveJson } from '../lib/storage';

export interface StartStep {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  action: () => void;
  actionLabel: string;
}

/** First-run checklist on the overview. Disappears when everything is done or when dismissed. */
export function GettingStartedCard({ steps }: { steps: StartStep[] }) {
  const [dismissed, setDismissed] = useState<boolean>(() => loadJson<boolean>('onboarding-dismissed') === true);
  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount === steps.length) return null;

  return (
    <section aria-label="Getting started" className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-7 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#8C6226]">Getting started · {doneCount}/{steps.length}</span>
          <h2 className="text-base font-bold text-stone-900 mt-0.5">Four quick steps to a plan you can trust</h2>
        </div>
        <button
          type="button"
          aria-label="Dismiss getting started"
          onClick={() => {
            saveJson('onboarding-dismissed', true);
            setDismissed(true);
          }}
          className="p-1 text-stone-400 hover:text-stone-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={s.action}
              disabled={s.done}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-2xl border transition-colors ${
                s.done ? 'bg-stone-50 border-stone-100 opacity-70' : 'border-stone-200 hover:bg-stone-50'
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  s.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300'
                }`}
              >
                {s.done && <Check className="w-3 h-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-semibold ${s.done ? 'line-through text-stone-400' : 'text-stone-900'}`}>{s.label}</span>
                <span className="block text-[11px] text-stone-500 leading-relaxed">{s.hint}</span>
              </span>
              {!s.done && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4A6B53] shrink-0 mt-0.5">
                  {s.actionLabel} <ArrowRight className="w-3 h-3" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
