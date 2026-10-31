/**
 * Deterministic personalised idea engine. Works with zero API keys and is
 * also used as the fallback when the Gemini-powered endpoint is unavailable.
 */

export interface IdeaRequest {
  eventType: string;
  title?: string;
  location?: string;
  guestCount: number;
  targetBudget: number;
  interests?: string;
  vibe?: string;
}

export interface IdeaCard {
  id: string;
  category: 'Theme' | 'Activity' | 'Food & Drink' | 'Decor' | 'Favor' | 'Money-saver' | 'Guest experience';
  title: string;
  description: string;
  estCostPerGuest?: number;
}

export interface IdeaSet {
  tier: 'intimate-luxe' | 'comfortable' | 'budget-smart';
  perGuestBudget: number;
  headline: string;
  ideas: IdeaCard[];
}

type Kind = 'wedding' | 'birthday' | 'community' | 'memorial';

function kindOf(eventType: string): Kind {
  const t = (eventType || '').toLowerCase();
  if (t.includes('wedding')) return 'wedding';
  if (t.includes('birthday')) return 'birthday';
  if (t.includes('funeral') || t.includes('memorial')) return 'memorial';
  return 'community';
}

const THEMES: Record<Kind, { vibe: string; title: string; description: string }[]> = {
  wedding: [
    { vibe: 'romantic', title: 'Garden Hour Romance', description: 'Soft blush and sage palette, candlelit tables, loose seasonal florals and a string-quartet processional.' },
    { vibe: 'modern', title: 'Gallery Minimal', description: 'Clean lines, white-on-white florals with one bold accent colour, sculptural lighting and a plated tasting menu.' },
    { vibe: 'rustic', title: 'Harvest Table', description: 'Long family-style tables, wildflower jars, kraft-and-linen details and a farm-to-table feast.' },
    { vibe: 'cultural', title: 'Heritage Celebration', description: 'Weave family traditions into the day: ceremony rituals, signature textiles, and a playlist that spans generations.' },
    { vibe: 'bold', title: 'Midnight Jewel Box', description: 'Deep emerald and burgundy, brass candelabras, velvet lounge corners and a late-night dessert bar.' },
  ],
  birthday: [
    { vibe: 'modern', title: 'Rooftop Golden Hour', description: 'Sunset cocktails, string lights, a signature drink named after the guest of honour and a vinyl DJ set.' },
    { vibe: 'playful', title: 'Through the Decades', description: 'One corner per decade of their life with music, photos and props — guests pick their favourite era.' },
    { vibe: 'romantic', title: 'Supper Club Soirée', description: 'One long candlelit table, shared plates, toasts between courses and a live acoustic set.' },
    { vibe: 'bold', title: 'Neon Arcade Night', description: 'Retro arcade cabinets, glow decor, mocktail bar and a photo booth with instant prints.' },
    { vibe: 'rustic', title: 'Backyard Bonfire & BBQ', description: 'Smoked mains, lawn games, s’mores station and blankets for a cosy fire circle.' },
  ],
  community: [
    { vibe: 'cultural', title: 'Heritage Night Market', description: 'Local food stalls, makers’ tables, live performances and a storytelling stage celebrating neighbourhood history.' },
    { vibe: 'playful', title: 'Family Field Day', description: 'Relay games, face painting, a kids’ craft tent and a community potluck lunch.' },
    { vibe: 'modern', title: 'Open-Air Festival', description: 'Two-stage lineup, food-truck row, sustainable zero-waste stations and a donation-driven raffle.' },
    { vibe: 'romantic', title: 'Lantern Evening', description: 'Twilight walk with paper lanterns, acoustic sets and hot-drink stations — low cost, high memory.' },
    { vibe: 'bold', title: 'Fundraiser Gala', description: 'Dress-up evening with silent auction, short impact stories and a pledge-matching moment.' },
  ],
  memorial: [
    { vibe: 'romantic', title: 'Celebration of Life', description: 'Warm lighting, a memory table with photos and favourite objects, and shared stories over comfort food.' },
    { vibe: 'rustic', title: 'Garden Remembrance', description: 'Seasonal flowers guests can take home, an open-mic of memories and a favourite-song playlist.' },
  ],
};

const ACTIVITIES: Record<Kind, string[]> = {
  wedding: ['Guest message jar or audio guestbook', 'Lawn games during cocktail hour', 'Live painter capturing the ceremony', 'Late-night street-food truck', 'Sparkler send-off', 'Handwritten “open when…” letters for the couple'],
  birthday: ['Memory wall where guests pin photos & notes', 'Signature cocktail workshop', 'Karaoke or live band-aoke segment', 'Polaroid guest book', 'Surprise video montage from friends abroad', 'Blind-taste challenge of the guest of honour’s favourites'],
  community: ['Volunteer-run kids’ corner', 'Local-artist pop-up gallery', 'Neighbourhood trivia', 'Photo-walk scavenger hunt', 'Community mural wall', 'Open-mic stage'],
  memorial: ['Memory table with photographs', 'Shared-story circle', 'Seed packets or sapling favours', 'Collective playlist of their favourite songs'],
};

const FOOD: Record<Kind, string[]> = {
  wedding: ['Seasonal tasting menu with a family-recipe course', 'Signature his-and-hers cocktails', 'Grazing tables for cocktail hour', 'Dessert bar replacing a single cake', 'Late-night snack bag at the exit'],
  birthday: ['Passed canapés + one hero dish', 'Cocktail menu named after inside jokes', 'Mini-dessert trio instead of a large cake', 'Build-your-own taco / slider bar', 'Coffee & digestif cart to end the night'],
  community: ['Food-truck rotation (3–4 trucks)', 'Potluck with allergen labels', 'Local bakery pastry table', 'Hot-drinks station for cold weather', 'Water refill stations (cuts cost & waste)'],
  memorial: ['Comfort-food buffet', 'Family-style trays', 'Tea & coffee service', 'Signature dessert from the loved one’s kitchen'],
};

const DECOR: Record<Kind, string[]> = {
  wedding: ['Reusable ceremony florals repurposed on the reception tables', 'Fabric draping & fairy lights over expensive floral arches', 'Potted herbs as centrepieces guests can take home', 'Vintage mismatched candlesticks for texture'],
  birthday: ['Balloon garland in a 3-colour palette', 'Large-format age numerals as photo backdrop', 'Projected photo slideshow on a blank wall', 'Thrifted brass and glass for low-cost glamour'],
  community: ['Bunting and banners from local print shop sponsor', 'Hay-bale seating', 'Chalkboard signage volunteers can update', 'Sponsor-branded wayfinding totems'],
  memorial: ['Single-colour flowers (the loved one’s favourite)', 'Framed photos with soft candles (LED for venues)', 'Fabric swags in neutral tones'],
};

const SAVERS: string[] = [
  'Hold the event on a Friday or Sunday — venues often discount 15–30%.',
  'Trim the guest list by 10% to save roughly 10% of your per-guest costs.',
  'Choose in-season flowers; out-of-season stems can cost 2–3× more.',
  'Ask venue about “inclusive” packages — rentals, linens and setup bundled.',
  'Book vendors off-peak months and request a package discount for 2+ services.',
  'Digital invitations + a QR-code RSVP save printing and postage.',
  'Skip the full open bar: beer, wine and one signature cocktail cover most guests.',
  'DIY favours that double as place cards.',
];

const FAVORS: Record<Kind, string[]> = {
  wedding: ['Mini olive-oil or honey jars', 'Plantable seed-paper cards', 'Custom playlist QR card'],
  birthday: ['Custom sticker sheet', 'Mini candle with the date', 'Instant photo print'],
  community: ['Reusable tote with sponsor logos', 'Local-produce samples', 'Seed packets'],
  memorial: ['Seed packet with a note', 'Printed memory card', 'Small candle'],
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededPick<T>(arr: T[], seed: number, n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  let s = seed || 1;
  while (copy.length && out.length < n) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push(copy.splice(s % copy.length, 1)[0]);
  }
  return out;
}

export function generateIdeas(req: IdeaRequest, variation = 0): IdeaSet {
  const guests = Math.max(1, Math.round(req.guestCount) || 1);
  const budget = Math.max(0, Number(req.targetBudget) || 0);
  const perGuest = Math.round(budget / guests);
  const kind = kindOf(req.eventType);
  const tier: IdeaSet['tier'] =
    perGuest >= (kind === 'wedding' ? 450 : 160) ? 'intimate-luxe' : perGuest >= (kind === 'wedding' ? 220 : 70) ? 'comfortable' : 'budget-smart';

  const seed = hash(`${req.eventType}|${req.title ?? ''}|${req.location ?? ''}|${guests}|${req.interests ?? ''}|${variation}`);
  const interestWords = (req.interests ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  // Theme ranking: requested vibe first, then interest hits, then seeded shuffle.
  const vibe = (req.vibe ?? '').toLowerCase();
  const themes = [...THEMES[kind]].sort((a, b) => {
    const score = (t: (typeof THEMES)[Kind][number]) =>
      (vibe && t.vibe === vibe ? 10 : 0) +
      interestWords.filter((w) => `${t.title} ${t.description}`.toLowerCase().includes(w)).length * 3;
    return score(b) - score(a) || (hash(a.title + seed) % 7) - (hash(b.title + seed) % 7);
  });

  const ideas: IdeaCard[] = [];
  themes.slice(0, 2).forEach((t, i) =>
    ideas.push({ id: `theme-${i}`, category: 'Theme', title: t.title, description: t.description })
  );

  if (interestWords.length) {
    ideas.push({
      id: 'interest-0',
      category: 'Guest experience',
      title: `Personal touch: ${interestWords.slice(0, 3).join(' · ')}`,
      description: `Work their passions (${interestWords.slice(0, 3).join(', ')}) into the day — a themed signature drink, table names, or a keepsake that tells their story.`,
      estCostPerGuest: Math.max(2, Math.round(perGuest * 0.02)),
    });
  }

  seededPick(ACTIVITIES[kind], seed, 2).forEach((a, i) =>
    ideas.push({ id: `act-${i}`, category: 'Activity', title: a, description: 'Low-effort moment that gets guests mingling and creates shareable memories.', estCostPerGuest: Math.max(1, Math.round(perGuest * 0.015)) })
  );
  seededPick(FOOD[kind], seed >>> 3, 2).forEach((a, i) =>
    ideas.push({ id: `food-${i}`, category: 'Food & Drink', title: a, description: tier === 'budget-smart' ? 'Swap to batch-served formats to cut staffing and waste.' : 'Pairs well with your guest count and keeps service flowing.', estCostPerGuest: Math.max(3, Math.round(perGuest * 0.12)) })
  );
  seededPick(DECOR[kind], seed >>> 5, 1).forEach((a, i) =>
    ideas.push({ id: `decor-${i}`, category: 'Decor', title: a, description: 'Maximum visual impact per dollar.' })
  );
  seededPick(FAVORS[kind], seed >>> 7, 1).forEach((a, i) =>
    ideas.push({ id: `favor-${i}`, category: 'Favor', title: a, description: 'A small thank-you guests will actually keep.', estCostPerGuest: Math.max(1, Math.round(perGuest * 0.01)) })
  );
  const saverCount = tier === 'budget-smart' ? 3 : 2;
  seededPick(SAVERS, seed >>> 9, saverCount).forEach((a, i) =>
    ideas.push({ id: `save-${i}`, category: 'Money-saver', title: a, description: 'Applies directly to your target budget.' })
  );

  const headline =
    tier === 'intimate-luxe'
      ? `At about $${perGuest.toLocaleString()} per guest you can afford premium touches — invest where guests feel it most.`
      : tier === 'comfortable'
        ? `At about $${perGuest.toLocaleString()} per guest you have a healthy budget — balance a few splurges with smart savings.`
        : `At about $${perGuest.toLocaleString()} per guest, creativity beats spend — these ideas stretch every dollar.`;

  return { tier, perGuestBudget: perGuest, headline, ideas };
}
