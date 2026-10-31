import type { MoodboardPalette } from '../types/domain';

/**
 * Keyword-driven moodboard generator used when no vision model is available.
 * The creative brief genuinely shapes the output (colours, decor, lighting).
 */

interface Style {
  keys: string[];
  title: string;
  archetype: string;
  swatches: [string, string, string][];
  decor: string[];
  lighting: string;
  florals: string[];
  food: string[];
}

const STYLES: Style[] = [
  {
    keys: ['boho', 'bohemian', 'pampas', 'desert', 'terracotta', 'earthy'],
    title: 'Sun-Baked Bohemian',
    archetype: 'Relaxed Boho Luxe',
    swatches: [['#C67D5A', 'Terracotta', 'Ceramics & table accents'], ['#E8D5B7', 'Sand', 'Linens & paper goods'], ['#8A9A5B', 'Moss', 'Greenery & napkins'], ['#B5651D', 'Burnt Ochre', 'Candles & ribbons'], ['#3B2F2F', 'Espresso', 'Signage']],
    decor: ['Pampas grass arches', 'Rattan chargers and woven placemats', 'Low floor cushions in lounge corners'],
    lighting: 'Warm 2200K string lights and lanterns at dusk.',
    florals: ['Dried grasses & preserved palms', 'Protea and wildflowers'],
    food: ['Mezze grazing boards (Vegan / GF options)', 'Charred citrus cocktails'],
  },
  {
    keys: ['garden', 'sage', 'green', 'botanical', 'forest', 'woodland', 'spring', 'floral'],
    title: 'Secret Garden',
    archetype: 'Botanical Romance',
    swatches: [['#8FA58A', 'Sage', 'Linens & foliage'], ['#F4E4E1', 'Blush', 'Florals & stationery'], ['#F5F2EB', 'Chalk', 'Tablecloths'], ['#B88B4A', 'Antique Gold', 'Cutlery & candlesticks'], ['#2F3E34', 'Forest', 'Signage & menus']],
    decor: ['Greenery table runners with taper candles', 'Vintage glass bud vases', 'Hand-lettered garden-style signage'],
    lighting: 'Soft golden-hour glow with candles and fairy lights.',
    florals: ['Garden roses & ranunculus', 'Eucalyptus and olive branches'],
    food: ['Seasonal farm-to-table menu', 'Herb-infused spritzes'],
  },
  {
    keys: ['modern', 'minimal', 'minimalist', 'monochrome', 'black', 'white', 'gallery', 'sleek', 'industrial', 'loft'],
    title: 'Gallery Minimal',
    archetype: 'Modern Architectural',
    swatches: [['#F7F7F5', 'Gallery White', 'Linens & backdrops'], ['#1F2421', 'Ink', 'Signage & type'], ['#9AA5A0', 'Concrete', 'Plinths & stationery'], ['#C9A66B', 'Brushed Brass', 'Hardware & accents'], ['#C86D51', 'Clay Accent', 'Single bold accent colour']],
    decor: ['Sculptural plinths for centrepieces', 'Monochrome menu cards on heavy stock', 'Statement lighting installation'],
    lighting: 'Crisp architectural spotlighting with a warm dimmed ambient layer.',
    florals: ['Single-variety monochrome stems', 'Sculptural branches'],
    food: ['Plated tasting menu', 'Signature clear cocktails'],
  },
  {
    keys: ['royal', 'regal', 'jewel', 'emerald', 'burgundy', 'velvet', 'palace', 'maharaja', 'opulent', 'gala', 'glam', 'gold'],
    title: 'Jewel Box Opulence',
    archetype: 'Regal Glamour',
    swatches: [['#0F5C4D', 'Emerald', 'Drapery & velvet lounge'], ['#7B1E3A', 'Burgundy', 'Florals & napkins'], ['#D4AF37', 'Gold Leaf', 'Candelabras & chargers'], ['#F3E9DC', 'Ivory', 'Linens'], ['#1B1B1F', 'Onyx', 'Signage']],
    decor: ['Brass candelabras and mirrored table tops', 'Velvet drapes and ornate frames', 'Gold-rimmed glassware'],
    lighting: 'Low, dramatic candlelight with chandelier accents.',
    florals: ['Deep-red dahlias and amaranthus', 'Marigold garlands'],
    food: ['Multi-course feast with dessert bar', 'Spiced chai or champagne service'],
  },
  {
    keys: ['beach', 'ocean', 'coastal', 'nautical', 'tropical', 'island', 'summer', 'blue', 'seaside'],
    title: 'Coastal Breeze',
    archetype: 'Seaside Relaxed',
    swatches: [['#8EC5D6', 'Sea Glass', 'Linens & ribbons'], ['#F5EBDD', 'Sand', 'Stationery'], ['#2E6F8E', 'Deep Tide', 'Accents & signage'], ['#F2B880', 'Sunset Peach', 'Florals'], ['#FFFFFF', 'Foam', 'Tablecloths']],
    decor: ['Driftwood signage', 'Rope-wrapped lanterns', 'Shell place-card holders'],
    lighting: 'Natural daylight into soft lantern light after sunset.',
    florals: ['Tropical monstera & palms', 'White orchids'],
    food: ['Fresh seafood station', 'Frozen citrus cocktails'],
  },
  {
    keys: ['festival', 'carnival', 'colorful', 'colourful', 'vibrant', 'rainbow', 'party', 'neon', 'retro', 'fun', 'playful'],
    title: 'Technicolour Celebration',
    archetype: 'Playful & Vibrant',
    swatches: [['#F2C94C', 'Sunshine', 'Balloons & bunting'], ['#E0457B', 'Hot Pink', 'Neon & signage'], ['#2A9D8F', 'Teal', 'Backdrops'], ['#7B61FF', 'Electric Violet', 'Lighting gels'], ['#FFF4E0', 'Cream', 'Tables']],
    decor: ['Oversized balloon installation', 'Neon sign photo wall', 'Mismatched bright tableware'],
    lighting: 'Coloured wash lighting with a disco-ball moment.',
    florals: ['Bright gerbera and zinnias', 'Paper flower backdrops'],
    food: ['Street-food stations', 'Mocktail bar with colourful garnishes'],
  },
  {
    keys: ['memorial', 'remembrance', 'tribute', 'serene', 'calm', 'peaceful', 'quiet'],
    title: 'Quiet Remembrance',
    archetype: 'Serene Tribute',
    swatches: [['#E8E4DC', 'Ivory', 'Linens'], ['#9AA5A0', 'Sage Grey', 'Florals'], ['#6B705C', 'Olive', 'Greenery'], ['#C9B8A6', 'Warm Stone', 'Programs'], ['#3A3A3A', 'Slate', 'Signage']],
    decor: ['Memory table with framed photographs', 'Soft candles (LED where required)', 'Fabric swags in neutral tones'],
    lighting: 'Gentle warm lighting; avoid harsh spotlights.',
    florals: ['White lilies and roses', 'Seasonal greenery'],
    food: ['Comfort-food buffet', 'Tea and coffee service'],
  },
];

const DEFAULT_STYLE = STYLES[1];

export function generateMoodboard(params: {
  prompt: string;
  eventId: string;
  eventType?: string;
  location?: string;
}): MoodboardPalette {
  const text = `${params.prompt} ${params.eventType ?? ''}`.toLowerCase();
  let best = DEFAULT_STYLE;
  let bestScore = 0;
  for (const st of STYLES) {
    const score = st.keys.filter((k) => text.includes(k)).length;
    if (score > bestScore) {
      best = st;
      bestScore = score;
    }
  }
  const brief = params.prompt.trim();
  return {
    id: `mb_${Date.now()}`,
    event_id: params.eventId,
    title: brief ? `${best.title} — "${brief.slice(0, 36)}${brief.length > 36 ? '…' : ''}"` : best.title,
    style_archetype: best.archetype,
    color_Swatches: best.swatches.map(([hex, name, usage]) => ({ hex, name, usage })),
    decor_elements: best.decor,
    lighting_atmosphere: best.lighting,
    floral_botanical_notes: best.florals,
    culinary_dietary_pairings: [...best.food, 'Clearly label vegetarian, vegan, gluten-free and nut-free options'],
  };
}
