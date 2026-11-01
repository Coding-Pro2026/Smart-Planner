import { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { loadJson, saveJson } from '../lib/storage';
import { Card, CardHeader, cx, focusRing } from './ui/kit';

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
    <Card aria-labelledby="ov-start" className="p-6">
      <div className="flex items-start justify-between gap-4">
        <CardHeader id="ov-start" eyebrow={`Getting started · ${doneCount}/${steps.length}`} title="Four quick steps to a plan you can trust" />
        <button
          type="button"
          aria-label="Dismiss getting started"
          onClick={() => {
            saveJson('onboarding-dismissed', true);
            setDismissed(true);
          }}
          className={cx('-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900', focusRing)}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={s.action}
              disabled={s.done}
              className={cx(
                'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-[background-color,border-color,transform] duration-150 motion-reduce:transition-none',
                s.done ? 'border-stone-100 bg-stone-50' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 active:scale-[0.99] motion-reduce:active:scale-100',
                focusRing
              )}
            >
              <span
                aria-hidden="true"
                className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', s.done ? 'border-[#3B5943] bg-[#3B5943] text-white' : 'border-stone-400')}
              >
                {s.done && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx('block text-sm font-medium leading-5', s.done ? 'text-stone-500 line-through' : 'text-stone-900')}>
                  {s.label}
                  {s.done && <span className="sr-only"> (done)</span>}
                </span>
                <span className="block text-sm leading-5 text-stone-600">{s.hint}</span>
              </span>
              {!s.done && (
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#3B5943] dark:text-emerald-300">
                  {s.actionLabel} <ArrowRight aria-hidden="true" className="h-3 w-3" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
