import { useMemo, useState } from 'react';
import { Lightbulb, PiggyBank, Plus, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import type { EventRecord } from '../types/domain';
import { generateIdeas, type IdeaCard, type IdeaSet } from '../lib/ideas';
import { postJson } from '../lib/api';

const VIBES = ['', 'romantic', 'modern', 'rustic', 'playful', 'cultural', 'bold'];

const catTone: Record<IdeaCard['category'], string> = {
  Theme: 'bg-amber-50 text-amber-800',
  Activity: 'bg-sky-50 text-sky-800',
  'Food & Drink': 'bg-rose-50 text-rose-800',
  Decor: 'bg-emerald-50 text-emerald-800',
  Favor: 'bg-stone-100 text-stone-700',
  'Money-saver': 'bg-green-50 text-green-800',
  'Guest experience': 'bg-orange-50 text-orange-800',
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
  const [source, setSource] = useState<'local' | 'gemini'>('local');

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

  const shown = source === 'gemini' && aiSet ? aiSet : localSet;

  const askAi = async () => {
    setLoading(true);
    const res = await postJson<{ source: 'gemini' | 'local'; set: IdeaSet }>(
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
      setSource(res.data.source === 'gemini' ? 'gemini' : 'local');
      onToast(
        'success',
        res.data.source === 'gemini'
          ? 'Fresh Gemini-powered ideas ready'
          : 'Ideas refreshed with the built-in planning engine'
      );
    } else {
      setSource('local');
      setVariation((v) => v + 1);
      onToast('info', 'AI is offline — generated new ideas with the built-in engine.');
    }
  };

  return (
    <section className="space-y-6" aria-label="Idea studio">
      <div className="bg-white border border-stone-200/80 rounded-3xl p-7 shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-[#8C6226] inline-flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Idea Studio
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-1">Personalised ideas for {event.title}</h2>
            <p className="text-xs text-stone-500 mt-1 max-w-xl">{shown.headline}</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
            {source === 'gemini' ? 'Powered by Gemini' : 'Built-in engine · works offline'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end text-xs">
          <label className="block">
            <span className="block font-medium text-stone-700 mb-1.5">
              What do they love? (hobbies, cuisine, music, culture…)
            </span>
            <input
              type="text"
              value={interests}
              maxLength={200}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. jazz, sushi, hiking, vintage cars"
              className="w-full px-3.5 py-2 border border-stone-300 rounded-xl"
            />
          </label>
          <label className="block">
            <span className="block font-medium text-stone-700 mb-1.5">Vibe</span>
            <select
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              className="w-full px-3.5 py-2 border border-stone-300 rounded-xl capitalize"
            >
              {VIBES.map((v) => (
                <option key={v} value={v}>
                  {v || 'Surprise me'}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSource('local');
                setVariation((v) => v + 1);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Shuffle
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={askAi}
              className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl"
            >
              <Wand2 className="w-3.5 h-3.5" /> {loading ? 'Thinking…' : 'Ask AI'}
            </button>
          </div>
        </div>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.ideas.map((idea) => (
          <li
            key={idea.id}
            className="bg-white border border-stone-200/80 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="space-y-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md ${catTone[idea.category] ?? 'bg-stone-100 text-stone-700'}`}>
                {idea.category === 'Money-saver' ? <PiggyBank className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                {idea.category}
              </span>
              <h3 className="text-sm font-bold text-stone-900 leading-snug">{idea.title}</h3>
              <p className="text-xs text-stone-500 leading-relaxed">{idea.description}</p>
              {idea.estCostPerGuest ? (
                <p className="text-[11px] font-mono text-stone-600">≈ ${idea.estCostPerGuest}/guest</p>
              ) : null}
            </div>
            {idea.category !== 'Money-saver' && (
              <div className="flex gap-2">
                {idea.estCostPerGuest ? (
                  <button
                    type="button"
                    onClick={() => onAddBudgetItem(idea)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-[#4A6B53] bg-[#EDF3EE] hover:bg-[#DFECE1] rounded-xl"
                  >
                    <Plus className="w-3 h-3" /> Add to budget
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onAddTask(idea)}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl"
                >
                  <Plus className="w-3 h-3" /> Add to timeline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
