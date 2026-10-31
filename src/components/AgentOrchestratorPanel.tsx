import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
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
  onSendMessage: (userPrompt: string) => Promise<void>;
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

export const AgentOrchestratorPanel: React.FC<AgentOrchestratorPanelProps> = ({
  event,
  messages,
  onSendMessage,
  onAcceptProposal,
  onRejectProposal,
  isOrchestrating,
}) => {
  const [input, setInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isOrchestrating) return;
    const text = input.trim();
    setInput('');
    await onSendMessage(text);
  };

  // Show the latest assistant message so the Bento cell stays clean and uncluttered
  const latestMessage = messages[messages.length - 1];

  return (
    <div className="h-full bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between gap-6">
      <div className="space-y-5">
        {/* Bento Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-medium text-indigo-600">AI Planning Co-Pilot</span>
              <h2 className="text-lg font-bold text-stone-900 leading-snug">
                What would you like to schedule or adjust?
              </h2>
            </div>
          </div>
        </div>

        {/* Clean Conversational Input */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center gap-2.5">
            <input
              type="text"
              placeholder="Ask to schedule a task, shift dates, or add an expense..."
              maxLength={500}
              aria-label="Message the AI planning assistant"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isOrchestrating}
              className="flex-1 px-4 py-3 text-sm bg-stone-50/90 border border-stone-200/90 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
            />
            <button
              type="submit"
              disabled={isOrchestrating || !input.trim()}
              className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-2xl transition-colors whitespace-nowrap shrink-0"
            >
              {isOrchestrating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Planning...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Ask AI
                </>
              )}
            </button>
          </div>

          {/* Subtle Quick Prompts */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {suggestionsFor(event.event_type).map((q, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isOrchestrating}
                onClick={() => onSendMessage(q)}
                className="px-3 py-1.5 text-xs text-stone-600 bg-stone-100/80 hover:bg-stone-200/70 hover:text-stone-900 rounded-xl transition-colors whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Latest Assistant Response & Action Confirmation (Unboxed hairline separation) */}
      {latestMessage && (
        <div className="pt-5 border-t border-stone-100 space-y-3 text-xs">
          <div className="flex items-center justify-between text-stone-400">
            <span className="font-semibold text-stone-800">
              {latestMessage.role === 'user' ? 'Your Request' : 'Latest Assistant Suggestion'}
            </span>
            {latestMessage.proposed_actions &&
              latestMessage.proposed_actions.length > 0 &&
              latestMessage.proposal_status === 'accepted' && (
                <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Applied to plan
                </span>
              )}
          </div>

          <div aria-live="polite" className="max-h-64 overflow-y-auto pr-1">
            <MiniMarkdown text={latestMessage.content} className="text-stone-600 leading-relaxed" />
          </div>

          {latestMessage.proposed_actions &&
            latestMessage.proposed_actions.length > 0 &&
            latestMessage.proposal_status !== 'accepted' &&
            latestMessage.proposal_status !== 'rejected' && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-stone-700">
                  {latestMessage.proposed_actions.map((act) => (
                    <div key={act.id} className="font-medium">
                      · {act.summary}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onAcceptProposal(latestMessage.id, latestMessage.proposed_actions!)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept &amp; Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectProposal(latestMessage.id)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Dismiss
                  </button>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};
