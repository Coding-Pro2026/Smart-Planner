import type { AgentName, MoodboardPalette, ProposedToolAction } from '../../types/domain';

/**
 * Validation of model output. LLMs (especially small/fast ones) return malformed or off-spec fields;
 * nothing from a model reaches the UI without passing through these.
 */

const AGENTS: AgentName[] = [
  'Supervisor Agent',
  'Theme & Ideation Agent',
  'Budget Allocator Agent',
  'Logistics & Timeline Agent',
  'Vendor & Contract Agent',
];
const TOOLS: ProposedToolAction['tool_name'][] = [
  'add_budget_item',
  'create_task',
  'shift_schedule',
  'compare_vendor_quotes',
  'parse_moodboard_palette',
];

export function cleanText(v: unknown, max: number, fallback = ''): string {
  if (typeof v !== 'string') return fallback;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : fallback;
}

/** A title containing JSON-ish debris or absurd length is replaced by the fallback. */
export function cleanTitle(v: unknown, fallback: string, max = 90): string {
  const t = cleanText(v, 400);
  if (!t || /color_?swatches|[{}[\]]|":|=>/i.test(t)) return fallback;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function sanitizeOrchestratorOutput(parsed: any): {
  sender_agent: AgentName;
  delegated_agents: AgentName[];
  reply: string;
  hasReply: boolean;
  actions: Omit<ProposedToolAction, 'id'>[];
} {
  const asAgent = (v: unknown): AgentName | null => AGENTS.find((a) => a === v) ?? null;
  const delegated = (Array.isArray(parsed?.delegated_agents) ? parsed.delegated_agents : [])
    .map(asAgent)
    .filter((a: AgentName | null): a is AgentName => a !== null);
  const actions = (Array.isArray(parsed?.proposed_actions) ? parsed.proposed_actions : [])
    .filter((a: any) => a && typeof a === 'object' && TOOLS.includes(a.tool_name))
    .slice(0, 5)
    .map((a: any) => ({
      tool_name: a.tool_name as ProposedToolAction['tool_name'],
      agent: asAgent(a.agent) ?? 'Logistics & Timeline Agent',
      summary: cleanText(a.summary, 200, 'Apply recommended planning update'),
      payload: a as Record<string, unknown>,
    }));
  return {
    sender_agent: asAgent(parsed?.sender_agent) ?? 'Supervisor Agent',
    delegated_agents: delegated.length ? delegated : ['Supervisor Agent'],
    reply: cleanText(parsed?.reply_markdown, 4000, 'Here are my suggestions.').trim(),
    hasReply: cleanText(parsed?.reply_markdown, 4000).length > 0,
    actions,
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Returns a validated palette, or null when the model's output is not usable. */
export function sanitizeMoodboard(parsed: any, eventId: string): MoodboardPalette | null {
  const swatches = (Array.isArray(parsed?.color_Swatches) ? parsed.color_Swatches : [])
    .filter((s: any) => s && typeof s.hex === 'string' && HEX.test(s.hex.trim()))
    .slice(0, 8)
    .map((s: any) => ({
      hex: s.hex.trim().toUpperCase(),
      name: cleanText(s.name, 40, 'Accent'),
      usage: cleanText(s.usage, 80, 'Accent'),
    }));
  if (swatches.length < 3) return null;
  const list = (v: unknown, fb: string[]) => {
    const out = (Array.isArray(v) ? v : []).map((x) => cleanText(x, 160)).filter(Boolean).slice(0, 8);
    return out.length ? out : fb;
  };
  return {
    id: `mb_${Date.now()}`,
    event_id: eventId,
    title: cleanTitle(parsed?.title, 'Custom Palette', 70),
    style_archetype: cleanTitle(parsed?.style_archetype, 'Curated Style', 60),
    color_Swatches: swatches,
    decor_elements: list(parsed?.decor_elements, ['Layered textures and candlelight']),
    lighting_atmosphere: cleanText(parsed?.lighting_atmosphere, 200, 'Warm, layered lighting.'),
    floral_botanical_notes: list(parsed?.floral_botanical_notes, ['Seasonal blooms and greenery']),
    culinary_dietary_pairings: list(parsed?.culinary_dietary_pairings, ['Clearly labelled dietary options']),
  };
}
