import { useMemo, useState } from 'react';
import { Lightbulb, PiggyBank, Plus, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import type { EventRecord } from '../types/domain';
import { generateIdeas, type IdeaCard, type IdeaSet } from '../lib/ideas';
import { postJson } from '../lib/api';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Skeleton, cx, inputCls } from './ui/kit';

const VIBES = ['', 'romantic', 'modern', 'rustic', 'playful', 'cultural', 'bold'];

const catTone: Record<IdeaCard['category'], string> = {
  Theme: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  Activity: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  'Food & Drink': 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  Decor: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  Favor: 'bg-stone-100 text-stone-700',
  'Money-saver': 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200',
  'Guest experience': 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
};

export function IdeaStudioView({
  event,
  onAddBudgetItem,
  onAddTask,
  onToast,
}: {
  event: EventRecord;
  onAddBudgetItem: (idea: IdeaCard) => void;
  onAddTask: (idea: IdeaCard) => void;
  onToast: (kind: 'success' | 'error' | 'info', text: string) => void;
}) {
  const [interests, setInterests] = useState('');
  const [vibe, setVibe] = useState('');
  const [variation, setVariation] = useState(0);
  const [aiSet, setAiSet] = useState<IdeaSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'local' | 'ai'>('local');

  const localSet = useMemo(
    () =>
      generateIdeas(
        {
          eventType: event.event_type,
          title: event.title,
          location: event.location,
          guestCount: event.guest_count,
          targetBudget: event.target_budget,
          interests,
          vibe,
        },
        variation
      ),
    [event, interests, vibe, variation]
  );

  const shown = source === 'ai' && aiSet ? aiSet : localSet;

  const askAi = async () => {
    setLoading(true);
    const res = await postJson<{ source: 'ai' | 'local'; provider?: string; set: IdeaSet }>(
      '/api/agents/ideas',
      {
        eventType: event.event_type,
        title: event.title,
        location: event.location,
        guestCount: event.guest_count,
        targetBudget: event.target_budget,
        interests,
        vibe,
      },
      { timeoutMs: 40_000 }
    );
    setLoading(false);
    if (res.ok && res.data?.set?.ideas?.length) {
      setAiSet(res.data.set);
      setSource(res.data.source === 'ai' ? 'ai' : 'local');
      onToast(
        'success',
        res.data.source === 'ai'
          ? 'Fresh AI-generated ideas ready'
          : 'Ideas refreshed with the built-in planning engine'
      );
    } else {
      setSource('local');
      setVariation((v) => v + 1);
      onToast('info', 'No AI key connected (or it failed) — generated new ideas with the built-in engine. Add your key via the key button.');
    }
  };

  return (
    <section className="space-y-6" aria-label="Idea studio">
      <PageHeader
        icon={<Lightbulb className="h-4 w-4" />}
        eyebrow="Idea studio"
        title={`Personalised ideas for ${event.title}`}
        description={shown.headline}
        actions={<Badge>{source === 'ai' ? 'Powered by your AI model' : 'Built-in engine · works offline'}</Badge>}
      >
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_200px_auto]">
          <Field label="What do they love?" hint="Hobbies, cuisine, music, culture…">
            <input
              type="text"
              value={interests}
              maxLength={200}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. jazz, sushi, hiking, vintage cars"
              className={inputCls}
            />
          </Field>
          <Field label="Vibe">
            <select value={vibe} onChange={(e) => setVibe(e.target.value)} className={cx(inputCls, 'capitalize')}>
              {VIBES.map((v) => (
                <option key={v} value={v}>
                  {v || 'Surprise me'}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2 md:pb-[1px]">
            <Button
              disabled={loading}
              onClick={() => {
                setSource('local');
                setVariation((v) => v + 1);
              }}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" /> Shuffle
            </Button>
            <Button variant="primary" disabled={loading} onClick={askAi} aria-busy={loading}>
              <Wand2 aria-hidden="true" className="h-4 w-4" /> {loading ? 'Thinking…' : 'Ask AI'}
            </Button>
          </div>
        </div>
      </PageHeader>

      <div aria-live="polite" className="sr-only">
        {loading ? 'Generating ideas' : `${shown.ideas.length} ideas shown`}
      </div>

      {loading ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <li key={n}>
              <Card as="div" className="space-y-3 p-5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-9 w-full" />
              </Card>
            </li>
          ))}
        </ul>
      ) : shown.ideas.length === 0 ? (
        <EmptyState icon={<Lightbulb className="h-5 w-5" />} title="No ideas yet" body="Add an interest or pick a vibe, then shuffle." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.ideas.map((idea) => (
            <li key={idea.id}>
              <Card as="article" interactive className="flex h-full flex-col justify-between gap-4 p-5">
                <div className="space-y-2">
                  <span className={cx('inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium', catTone[idea.category] ?? 'bg-stone-100 text-stone-700')}>
                    {idea.category === 'Money-saver' ? <PiggyBank aria-hidden="true" className="h-3 w-3" /> : <Sparkles aria-hidden="true" className="h-3 w-3" />}
                    {idea.category}
                  </span>
                  <h3 className="text-base font-semibold leading-6 tracking-[-0.01em] text-stone-900">{idea.title}</h3>
                  <p className="text-sm leading-5 text-stone-600">{idea.description}</p>
                  {idea.estCostPerGuest ? <p className="font-mono text-xs tabular-nums text-stone-700">≈ ${idea.estCostPerGuest}/guest</p> : null}
                </div>
                {idea.category !== 'Money-saver' && (
                  <div className="flex gap-2">
                    {idea.estCostPerGuest ? (
                      <Button variant="ghost" className="flex-1 !px-2" onClick={() => onAddBudgetItem(idea)}>
                        <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Budget
                      </Button>
                    ) : null}
                    <Button className="flex-1 !px-2" onClick={() => onAddTask(idea)}>
                      <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Timeline
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
