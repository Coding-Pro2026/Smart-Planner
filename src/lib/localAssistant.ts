import type { AgentName, ProposedToolAction } from '../types/domain';

/**
 * Offline planning co-pilot. Understands the common planning intents (move a
 * milestone, add a cost, add a task, status questions) and answers from the
 * user's real plan data. Used whenever Gemini is not configured or fails.
 */

export interface AssistantContext {
  eventContext?: {
    title?: string;
    event_type?: string;
    guest_count?: number;
    date?: string;
    location?: string;
  };
  budgetSummary?: { totalProjectedSpend?: number; targetBudget?: number; burnRatePct?: number };
  tasksSummary?: {
    id: string;
    title: string;
    status?: string;
    due_date?: string;
    is_critical_path?: boolean;
  }[];
  vendorsSummary?: { name: string; service_type?: string; total_true_cost?: number }[];
}

export interface AssistantReply {
  sender_agent: AgentName;
  delegated_agents: AgentName[];
  content: string;
  proposed_actions: ProposedToolAction[];
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const STOP = new Set(['the', 'a', 'an', 'by', 'to', 'for', 'of', 'and', 'in', 'on', 'my', 'our', 'task', 'milestone', 'delay', 'push', 'move', 'shift', 'postpone', 'back', 'out', 'earlier', 'later', 'days', 'day', 'weeks', 'week', 'forward', 'bring', 'advance']);

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
}

function findTask(prompt: string, tasks: NonNullable<AssistantContext['tasksSummary']>) {
  const pw = new Set(words(prompt));
  let best: { task: (typeof tasks)[number]; score: number } | null = null;
  for (const t of tasks) {
    const score = words(t.title).filter((w) => pw.has(w) || [...pw].some((p) => p.length > 4 && w.startsWith(p.slice(0, 5)))).length;
    if (score > 0 && (!best || score > best.score)) best = { task: t, score };
  }
  return best?.task ?? null;
}

const CATEGORY_RULES: [RegExp, string][] = [
  [/light|lamp|candle|pin-?spot/, 'Lighting & Scenography'],
  [/flor|flower|bouquet|centerpiece|centrepiece/, 'Floral & Decor'],
  [/photo|video|film|drone/, 'Photography & Video'],
  [/dj|band|music|sound|speaker|av\b|audio/, 'Music & Entertainment'],
  [/cater|food|menu|dinner|lunch|brunch|snack|bar\b|drink|cocktail|coffee|espresso|cake|dessert/, 'Catering & Beverage'],
  [/venue|hall|tent|rental|chair|table|linen/, 'Venue & Rentals'],
  [/shuttle|transport|bus|limo|car\b|parking/, 'Transportation'],
  [/invit|print|stationery|sign|banner/, 'Stationery & Print'],
  [/hotel|room|accommodation|lodging/, 'Accommodation'],
  [/secur|insur|permit|medic/, 'Safety & Permits'],
  [/gift|favor|favour|souvenir/, 'Favors & Gifts'],
];

function categoryFor(text: string): string {
  const lower = text.toLowerCase();
  return CATEGORY_RULES.find(([re]) => re.test(lower))?.[1] ?? 'Production & Decor';
}

function parseAmount(text: string): { amount: number; perGuest: boolean } | null {
  const m = text.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k)?/i) || text.match(/\b([\d,]{2,9})\s*(?:usd|dollars)\b/i);
  if (!m) return null;
  let amount = Number(String(m[1]).replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (m[2]) amount *= 1000;
  const perGuest = /per\s*(guest|head|person)|\/\s*(guest|head|person)|each guest|a head/i.test(text);
  return { amount, perGuest };
}

function cleanName(prompt: string): string {
  let n = prompt
    .replace(/\(?\$\s*[\d,]+(?:\.\d+)?\s*k?\)?/gi, '')
    .replace(/per\s*(guest|head|person)/gi, '')
    .replace(/^(?:please\s+)?(?:can you\s+)?(?:add|include|create|book|schedule|plan|budget for|put in)\s+(?:a|an|the|some)?\s*/i, '')
    .replace(/\s+(?:to|in|into)\s+(?:the\s+)?(?:budget|plan|timeline|schedule)\b.*$/i, '')
    .replace(/[.!?,;:]+$/, '')
    .replace(/\s+(?:for|at|of|about|around|costing|that costs|which costs|worth)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  n = n
    .replace(/\s*&\s*(?:a\s+)?(?:set\s?up|setup)(?:\s+task)?\s*$/i, '')
    .replace(/^(?:a\s+)?task\s*[:\-]?\s*(?:to\s+)?/i, '')
    .trim();
  if (!n) n = 'Custom item';
  return n.charAt(0).toUpperCase() + n.slice(1, 90);
}

function buildSingleReply(promptRaw: string, ctx: AssistantContext): AssistantReply {
  const prompt = String(promptRaw ?? '').trim();
  const lower = prompt.toLowerCase();
  const tasks = Array.isArray(ctx.tasksSummary) ? ctx.tasksSummary : [];
  const ev = ctx.eventContext ?? {};
  const b = ctx.budgetSummary ?? {};
  const name = ev.title ?? 'your event';
  const actions: ProposedToolAction[] = [];
  const stamp = Date.now();

  // ---- 1. Reschedule intent ---------------------------------------------
  if (/\b(delay|postpone|push|shift|move|reschedule|bring forward|advance|pull in)\b/.test(lower) && /(day|week|month)/.test(lower)) {
    const num = lower.match(/(\d+)\s*(day|week|month)/);
    const n = num ? Number(num[1]) : 7;
    const unit = num ? num[2] : 'day';
    let delta = n * (unit === 'week' ? 7 : unit === 'month' ? 30 : 1);
    if (/\b(earlier|forward|advance|pull in|sooner|up by)\b/.test(lower)) delta = -delta;
    const target = findTask(prompt, tasks) ?? tasks.find((t) => t.status !== 'completed') ?? tasks[0];
    if (target) {
      actions.push({
        id: `act_${stamp}_shift`,
        tool_name: 'shift_schedule',
        agent: 'Logistics & Timeline Agent',
        summary: `Move "${target.title}" ${delta > 0 ? 'later' : 'earlier'} by ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} and cascade dependent tasks`,
        payload: { target_task_id: target.id, task_title: target.title, delta_days: delta },
      });
      return {
        sender_agent: 'Supervisor Agent',
        delegated_agents: ['Supervisor Agent', 'Logistics & Timeline Agent'],
        content: `I matched **${target.title}**${target.due_date ? ` (currently due ${target.due_date})` : ''}. Moving it by **${delta > 0 ? '+' : ''}${delta} days** will shift every task that depends on it. Review and **Accept** to run the critical-path recalculation.`,
        proposed_actions: actions,
      };
    }
    return {
      sender_agent: 'Supervisor Agent',
      delegated_agents: ['Supervisor Agent'],
      content: 'There are no tasks on the timeline yet, so there is nothing to reschedule. Ask me to “add a task …” first.',
      proposed_actions: [],
    };
  }

  if (/\b(budget|spend|spent|afford|cost so far|how much)\b/.test(lower) && !/\badd\b/.test(lower) && !parseAmount(prompt)) {
    const rem = (b.targetBudget ?? 0) - (b.totalProjectedSpend ?? 0);
    return {
      sender_agent: 'Budget Allocator Agent',
      delegated_agents: ['Supervisor Agent', 'Budget Allocator Agent'],
      content: b.targetBudget
        ? `Projected spend is **${money(b.totalProjectedSpend ?? 0)}** against a **${money(b.targetBudget)}** target — ${rem >= 0 ? `**${money(rem)}** still unallocated` : `**${money(-rem)}** over`}. ${rem < 0 ? 'Consider trimming a high-share category or raising the cap.' : 'Keep ~5–10% as contingency.'}`
        : 'I don’t have budget numbers yet — add some line items on the Budget tab.',
      proposed_actions: [],
    };
  }

  // ---- 2. Status questions -------------------------------------------------
  if (/\b(status|summary|overview|how (are|is)|where (are|do) we|progress|on track|what'?s next|what is next|next step|what should|to do|todo)\b/.test(lower) && !/\badd\b/.test(lower)) {
    const open = tasks.filter((t) => t.status !== 'completed');
    const done = tasks.length - open.length;
    const next = [...open].sort((a, c) => (a.due_date ?? '').localeCompare(c.due_date ?? '')).slice(0, 3);
    const lines = [
      `**${name}** — ${done}/${tasks.length} milestones done.`,
      b.targetBudget
        ? `Budget: **${money(b.totalProjectedSpend ?? 0)}** projected of **${money(b.targetBudget)}** (${b.burnRatePct ?? 0}% used).`
        : '',
      next.length ? `Up next:\n${next.map((t) => `- ${t.title}${t.due_date ? ` _(due ${t.due_date})_` : ''}`).join('\n')}` : 'No open tasks — nice work!',
    ].filter(Boolean);
    return {
      sender_agent: 'Supervisor Agent',
      delegated_agents: ['Supervisor Agent', 'Logistics & Timeline Agent', 'Budget Allocator Agent'],
      content: lines.join('\n\n'),
      proposed_actions: [],
    };
  }

  if (/\bvendor|quote|contract\b/.test(lower) && !/\badd\b/.test(lower)) {
    const v = ctx.vendorsSummary ?? [];
    return {
      sender_agent: 'Vendor & Contract Agent',
      delegated_agents: ['Supervisor Agent', 'Vendor & Contract Agent'],
      content: v.length
        ? `You have **${v.length}** vendor quote${v.length > 1 ? 's' : ''}:\n${v.map((x) => `- ${x.name}${x.service_type ? ` (${x.service_type})` : ''}${x.total_true_cost ? ` — true cost ${money(x.total_true_cost)}` : ''}`).join('\n')}\n\nOpen the **Vendors** tab to paste a new quote and I’ll flag hidden fees and risky clauses; the **Vendor Checklist** shows what’s still unbooked.`
        : 'No vendor quotes yet. Paste one into the **Vendors** tab and I’ll expose hidden fees and risky clauses. The **Vendor Checklist** tab lists what to book and by when.',
      proposed_actions: [],
    };
  }

  // ---- 3. Add a budget item (has an amount) --------------------------------
  const amt = parseAmount(prompt);
  if (amt && /\b(add|include|budget|book|buy|hire|get|order|rent)\b/.test(lower)) {
    const itemName = cleanName(prompt);
    const guests = Math.max(1, Number(ev.guest_count) || 1);
    actions.push({
      id: `act_${stamp}_budget`,
      tool_name: 'add_budget_item',
      agent: 'Budget Allocator Agent',
      summary: `Add "${itemName}" — ${money(amt.amount)}${amt.perGuest ? ' per guest' : ''} (+8.5% tax, +5% contingency)`,
      payload: {
        category: categoryFor(prompt),
        name: itemName,
        unit_cost: amt.amount,
        quantity: amt.perGuest ? guests : 1,
        tax_pct: 8.5,
        contingency_pct: 5,
        is_per_guest: amt.perGuest,
      },
    });
    const wantsTask = /\b(setup|set up|task|install|schedule|book)\b/.test(lower);
    if (wantsTask) {
      actions.push({
        id: `act_${stamp}_task`,
        tool_name: 'create_task',
        agent: 'Logistics & Timeline Agent',
        summary: `Add milestone "Arrange: ${itemName}" (3 days)`,
        payload: { title: `Arrange: ${itemName}`, category: 'Operations', milestone_code: 'T-30', duration_days: 3, buffer_days: 1, assigned_to: 'Claire Vance', dependencies: [] },
      });
    }
    const total = amt.perGuest ? amt.amount * guests : amt.amount;
    return {
      sender_agent: 'Budget Allocator Agent',
      delegated_agents: ['Supervisor Agent', 'Budget Allocator Agent', ...(wantsTask ? (['Logistics & Timeline Agent'] as AgentName[]) : [])],
      content: `I prepared **${itemName}** at ${money(amt.amount)}${amt.perGuest ? ` × ${guests} guests = ${money(total)}` : ''}. The deterministic engine adds tax and contingency when you accept${b.targetBudget ? `; that is about ${Math.round(((total * 1.135) / b.targetBudget) * 100)}% of your target budget` : ''}.`,
      proposed_actions: actions,
    };
  }

  // ---- 4. Add a task ---------------------------------------------------------
  if (/\b(add|create|schedule|remind|plan|set up|book|arrange|confirm|order|send)\b/.test(lower)) {
    const title = cleanName(prompt);
    const dur = lower.match(/(\d+)\s*(day|week)/);
    const duration = dur ? Number(dur[1]) * (dur[2] === 'week' ? 7 : 1) : 3;
    const milestone = lower.match(/\bt-\d+\b/i)?.[0].toUpperCase() ?? 'T-30';
    actions.push({
      id: `act_${stamp}_task`,
      tool_name: 'create_task',
      agent: 'Logistics & Timeline Agent',
      summary: `Add milestone "${title}" (${duration} day${duration === 1 ? '' : 's'}, ${milestone})`,
      payload: { title, category: categoryFor(prompt) === 'Production & Decor' ? 'Operations' : categoryFor(prompt), milestone_code: milestone, duration_days: Math.min(60, Math.max(1, duration)), buffer_days: 1, assigned_to: 'Claire Vance', dependencies: [] },
    });
    return {
      sender_agent: 'Logistics & Timeline Agent',
      delegated_agents: ['Supervisor Agent', 'Logistics & Timeline Agent'],
      content: `Added to the plan for **${name}**: **${title}**. Accept to place it on the critical-path timeline.`,
      proposed_actions: actions,
    };
  }

  // ---- 5. Help ---------------------------------------------------------------
  const type = (ev.event_type ?? '').toLowerCase();
  const tips =
    type.includes('wedding')
      ? ['Add a $2,500 photo booth', 'Delay the venue walkthrough by 2 weeks', 'Add shuttle service $35 per guest']
      : type.includes('birthday')
        ? ['Add a $600 DJ', 'Add cake $250', 'What’s next on my timeline?']
        : ['Add portable restrooms $900', 'Add a task: confirm food truck permits', 'How is my budget?'];
  return {
    sender_agent: 'Supervisor Agent',
    delegated_agents: ['Supervisor Agent'],
    content: `I can reschedule milestones, add budget items, create tasks and report on status for **${name}**. Try:\n${tips.map((t) => `- “${t}”`).join('\n')}`,
    proposed_actions: [],
  };
}

/**
 * Handles compound requests ("add a DJ for $900 and delay the venue by 2 weeks") by answering each
 * clause separately and merging the proposals.
 */
export function buildLocalAssistantReply(promptRaw: string, ctx: AssistantContext): AssistantReply {
  const prompt = String(promptRaw ?? '').trim();
  const clauses = prompt
    .split(/\s*(?:,\s*(?:and\s+)?|;\s*|\s+and\s+(?=(?:also\s+)?(?:add|delay|push|move|shift|postpone|reschedule|create|schedule|book)\b)|\s+then\s+|\s+also\s+)/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);
  if (clauses.length < 2 || clauses.length > 4) return buildSingleReply(prompt, ctx);

  const parts = clauses.map((c) => buildSingleReply(c, ctx));
  const withActions = parts.filter((p) => p.proposed_actions.length > 0);
  if (withActions.length < 2) return buildSingleReply(prompt, ctx);

  const delegated = Array.from(new Set(parts.flatMap((p) => p.delegated_agents)));
  return {
    sender_agent: 'Supervisor Agent',
    delegated_agents: delegated,
    content: `I split your request into ${withActions.length} actions:\n\n${withActions.map((p) => p.content).join('\n\n')}`,
    proposed_actions: withActions.flatMap((p) => p.proposed_actions).map((a, i) => ({ ...a, id: `${a.id}_${i}` })),
  };
}
