import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, KeyRound, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { MiniMarkdown } from './MiniMarkdown';
import {
  AgentChatMessage,
  BudgetItemRecord,
  EventRecord,
  ProposedToolAction,
  TaskRecord,
  VendorRecord,
} from '../types/domain';

interface AgentOrchestratorPanelProps {
  event: EventRecord;
  messages: AgentChatMessage[];
  budgetItems: BudgetItemRecord[];
  tasks: TaskRecord[];
  vendors: VendorRecord[];
  aiLabel: string;
  aiConnected: boolean;
  onOpenAiSettings: () => void;
  onSendMessage: (userPrompt: string) => Promise<void>;
  onCancel: () => void;
  onAcceptProposal: (messageId: string, actions: ProposedToolAction[]) => void;
  onRejectProposal: (messageId: string) => void;
  isOrchestrating: boolean;
}

function suggestionsFor(eventType: string): string[] {
  const t = (eventType || '').toLowerCase();
  const common = ["What's next on my timeline?", 'How is my budget?'];
  if (t.includes('wedding')) return ['Add a $2,500 photo booth', 'Delay the first task by 2 weeks', ...common];
  if (t.includes('birthday')) return ['Add a DJ for $600', 'Add cake $250', ...common];
  if (t.includes('funeral') || t.includes('memorial')) return ['Add livestream AV $800', 'Add a task: print order-of-service', ...common];
  return ['Add portable restrooms $900', 'Add a task: confirm food truck permits', ...common];
}

/** Live "Thinking… 12s" counter so slow providers never look frozen. */
function useElapsed(active: boolean): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) {
      setSecs(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(t);
  }, [active]);
  return secs;
}

export const AgentOrchestratorPanel: React.FC<AgentOrchestratorPanelProps> = ({
  event,
  messages,
  aiLabel,
  aiConnected,
  onOpenAiSettings,
  onSendMessage,
  onCancel,
  onAcceptProposal,
  onRejectProposal,
  isOrchestrating,
}) => {
  const [input, setInput] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsed(isOrchestrating);
  const visible = messages.slice(-8);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isOrchestrating]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isOrchestrating) return;
    setInput('');
    await onSendMessage(text);
  };

  return (
    <section
      aria-label="AI planning assistant"
      className="bg-white border border-stone-200/80 rounded-3xl shadow-sm flex flex-col overflow-hidden max-h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-8rem)]"
    >
      {/* Header + AI status */}
      <div className="px-5 pt-5 pb-3 space-y-2.5 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#EDF3EE] text-[#4A6B53] flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-stone-900 leading-tight">Planning co-pilot</h2>
            <p className="text-[11px] text-stone-500 truncate">Proposes changes — you approve every one</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenAiSettings}
          className={`w-full inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
            aiConnected ? 'bg-[#EDF3EE] text-[#3b5943] hover:bg-[#DFECE1]' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
          }`}
        >
          <span className="inline-flex items-center gap-1.5 min-w-0">
            {aiConnected ? <Sparkles className="w-3 h-3 shrink-0" /> : <KeyRound className="w-3 h-3 shrink-0" />}
            <span className="truncate">{aiConnected ? `AI: ${aiLabel}` : 'Built-in engine · add your AI key for smarter answers'}</span>
          </span>
          <span className="opacity-70 shrink-0">{aiConnected ? 'Change' : 'Add'}</span>
        </button>
      </div>

      {/* Conversation */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[120px]" aria-live="polite">
        {visible.length === 0 && (
          <p className="text-xs text-stone-500 leading-relaxed">
            Ask me to move a milestone, add a cost or task, or summarise where you stand. Try one of the suggestions below.
          </p>
        )}
        {visible.map((m) => {
          const pending =
            m.proposed_actions && m.proposed_actions.length > 0 && m.proposal_status !== 'accepted' && m.proposal_status !== 'rejected';
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] bg-stone-900 text-white text-xs leading-relaxed px-3.5 py-2 rounded-2xl rounded-br-md">{m.content}</div>
              </div>
            );
          }
          return (
            <div key={m.id} className="space-y-2">
              <div className="max-w-[95%] bg-stone-50 border border-stone-200/70 text-xs text-stone-700 px-3.5 py-2.5 rounded-2xl rounded-bl-md">
                <MiniMarkdown text={m.content} className="leading-relaxed" />
              </div>
              {m.proposed_actions && m.proposed_actions.length > 0 && (
                <div className="ml-1 space-y-2">
                  <ul className="space-y-1 text-[11px] text-stone-700">
                    {m.proposed_actions.map((act) => (
                      <li key={act.id} className="flex gap-1.5">
                        <span className="text-[#B88B4A]">▸</span>
                        <span>{act.summary}</span>
                      </li>
                    ))}
                  </ul>
                  {pending ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAcceptProposal(m.id, m.proposed_actions!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept &amp; apply
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectProposal(m.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl"
                      >
                        <X className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                        m.proposal_status === 'accepted' ? 'text-emerald-700' : 'text-stone-400'
                      }`}
                    >
                      {m.proposal_status === 'accepted' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Applied to plan
                        </>
                      ) : (
                        'Dismissed'
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isOrchestrating && (
          <div className="flex items-center justify-between gap-3 bg-stone-50 border border-stone-200/70 rounded-2xl px-3.5 py-2.5 text-xs text-stone-600" role="status">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4A6B53]" />
              Thinking… {elapsed}s
              {elapsed >= 12 && <span className="text-stone-400">(slow provider — hang on or cancel)</span>}
            </span>
            <button type="button" onClick={onCancel} className="font-semibold text-rose-700 hover:underline">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-5 pb-5 pt-3 border-t border-stone-100 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {suggestionsFor(event.event_type).map((q) => (
            <button
              key={q}
              type="button"
              disabled={isOrchestrating}
              onClick={() => onSendMessage(q)}
              className="px-2.5 py-1 text-[11px] text-stone-600 bg-stone-100/80 hover:bg-stone-200/70 hover:text-stone-900 disabled:opacity-50 rounded-lg transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask to schedule a task, shift dates, or add an expense…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isOrchestrating}
            maxLength={500}
            aria-label="Message the AI planning assistant"
            className="flex-1 min-w-0 px-3.5 py-2.5 text-xs bg-stone-50/90 border border-stone-200/90 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
          />
          <button
            type="submit"
            disabled={isOrchestrating || !input.trim()}
            aria-label="Send"
            className="inline-flex items-center justify-center w-10 h-10 text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-40 rounded-xl transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </section>
  );
};
