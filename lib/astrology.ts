import { generateSimpleChart, DEFAULT_CONFIG, lonToSign, normalizeAngle } from "./canonical-calculator";
import type { PlanetState, AspectEdge, Angles, HouseState, DignityState } from "./canonical-types";

export type { PlanetState, AspectEdge, Angles, HouseState, DignityState };
export type { Body, AspectType, DignityStatus, AngularityClass } from "./canonical-types";
export { generateCanonicalChart, goldenInputToCanonicalInput } from "./canonical-calculator";
export type { CanonicalInput, GoldenInput } from "./canonical-calculator";
export type { CanonicalOutput } from "./canonical-types";

export type ZodiacSign =
  | "Aries" | "Taurus" | "Gemini" | "Cancer"
  | "Leo" | "Virgo" | "Libra" | "Scorpio"
  | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";

export type Planet =
  | "Sun" | "Moon" | "Mercury" | "Venus" | "Mars"
  | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto";

export type Aspect = "Conjunction" | "Sextile" | "Square" | "Trine" | "Opposition";

export interface PlanetaryPosition {
  planet: Planet;
  sign: ZodiacSign;
  degree: number;
  retrograde: boolean;
  house: number;
}

export interface TransitEvent {
  id: string;
  title: string;
  planet: Planet;
  aspect: Aspect;
  natalPlanet: Planet;
  sign: ZodiacSign;
  startDate: Date;
  peakDate: Date;
  endDate: Date;
  theme: "Agency" | "Relational" | "Structure" | "Expression" | "Inner Life";
  intensity: "subtle" | "moderate" | "significant";
  interpretation: string;
  opportunity: string;
}

export interface ThemeScores {
  Agency: number;
  Relational: number;
  Structure: number;
  Expression: number;
  "Inner Life": number;
}

export interface NatalChart {
  sun: ZodiacSign;
  moon: ZodiacSign;
  ascendant: ZodiacSign;
  mercury: ZodiacSign;
  venus: ZodiacSign;
  mars: ZodiacSign;
  jupiter: ZodiacSign;
  saturn: ZodiacSign;
  stellium: ZodiacSign | null;
  dominantElement: "Fire" | "Earth" | "Air" | "Water";
  sect: "diurnal" | "nocturnal";
  bodies: PlanetState[];
  aspects: AspectEdge[];
  angles: Angles;
  houses: HouseState[];
  dignities: DignityState[];
}

const ELEMENTS: Record<ZodiacSign, "Fire" | "Earth" | "Air" | "Water"> = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water",
};

function daysSinceJ2000(date: Date): number {
  const j2000 = new Date("2000-01-01T12:00:00Z");
  return (date.getTime() - j2000.getTime()) / (1000 * 60 * 60 * 24);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function getPlanetaryPosition(planet: Planet, date: Date): PlanetaryPosition {
  const chart = generateSimpleChart(date, 12);
  const body = chart.bodies.find(b => b.body === planet);
  if (!body) {
    return { planet, sign: "Aries", degree: 0, retrograde: false, house: 1 };
  }
  return {
    planet,
    sign: body.sign as ZodiacSign,
    degree: body.lon % 30,
    retrograde: body.retrograde,
    house: body.house,
  };
}

export function generateNatalChart(
  birthDate: Date,
  birthHour: number = 12,
  geoLat: number = 0,
  geoLon: number = 0,
): NatalChart {
  const result = generateSimpleChart(birthDate, birthHour, geoLat, geoLon);
  return result as NatalChart;
}

const TRANSIT_INTERPRETATIONS: Record<string, { interpretation: string; opportunity: string; theme: TransitEvent["theme"] }> = {
  "Jupiter_Trine_Sun": {
    interpretation: "A golden window of expansion opens. Jupiter's benefic rays harmonize with your solar essence, amplifying vitality and optimism. Doors that have been closed may now swing open.",
    opportunity: "Take the leap on projects requiring visibility or leadership. Your confidence is unusually supported.",
    theme: "Agency",
  },
  "Saturn_Square_Moon": {
    interpretation: "Emotional structures are tested. Saturn's discipline encounters your instinctual nature, creating productive friction that demands you examine old patterns.",
    opportunity: "Use this containment to establish healthier emotional habits and boundaries with others.",
    theme: "Structure",
  },
  "Venus_Conjunction_Mercury": {
    interpretation: "The mind and heart merge in a rare alignment. Communication becomes elegant and persuasive. Creative expression flows through words, design, and connection.",
    opportunity: "Schedule important conversations, creative proposals, or social engagements during this window.",
    theme: "Expression",
  },
  "Mars_Opposition_Saturn": {
    interpretation: "Drive meets restriction in a tense standoff. Initiative is slowed or blocked, inviting you to refine your approach rather than force through obstacles.",
    opportunity: "Channel this friction into precision work. Slow and methodical beats impulsive under this influence.",
    theme: "Agency",
  },
  "Neptune_Sextile_Venus": {
    interpretation: "Idealism and beauty merge in a gentle mist. Romantic impressions deepen, and creative work takes on an otherworldly quality.",
    opportunity: "Trust your aesthetic instincts and allow yourself to be moved by beauty and connection.",
    theme: "Relational",
  },
  "Pluto_Trine_Mars": {
    interpretation: "Transformative power channels through your will. Deep reserves of determination surface, making this an exceptional window for sustained, purposeful effort.",
    opportunity: "Commit to the work that requires the most from you. Transformation is earned through action here.",
    theme: "Inner Life",
  },
  "Mercury_Retrograde_Mercury": {
    interpretation: "The messenger turns inward, inviting review rather than new begins. Communication slows, technology tests patience, but reflection yields profound insights.",
    opportunity: "Revisit shelved projects, restore broken connections, and refine unfinished thinking.",
    theme: "Expression",
  },
  "Jupiter_Sextile_Moon": {
    interpretation: "Emotional abundance flows with ease. Your intuition is amplified and connections with loved ones deepen naturally.",
    opportunity: "Lean into community, family, and nurturing. Your capacity to give and receive support is heightened.",
    theme: "Relational",
  },
  "Saturn_Conjunction_Sun": {
    interpretation: "A time of reckoning with identity and purpose. Saturn's weight presses on your solar core, demanding authenticity and pruning what is no longer essential.",
    opportunity: "Do the serious work of defining who you are becoming. Commitments made now carry lasting weight.",
    theme: "Structure",
  },
  "Uranus_Square_Sun": {
    interpretation: "Disruption arrives as catalyst. Uranus cracks open habitual identity, forcing authentic reinvention. What feels destabilizing is actually liberating.",
    opportunity: "Embrace the unexpected. Radical changes you've been avoiding are now unavoidable—and necessary.",
    theme: "Inner Life",
  },
};

export function generateTransitEvents(chart: NatalChart, fromDate: Date, count: number = 8): TransitEvent[] {
  const transitingPlanets: Planet[] = ["Jupiter", "Saturn", "Mars", "Venus", "Mercury", "Pluto", "Uranus", "Neptune"];
  const natalPlanets: Planet[] = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
  const aspects: Aspect[] = ["Conjunction", "Sextile", "Square", "Trine", "Opposition"];
  const intensities: TransitEvent["intensity"][] = ["subtle", "moderate", "significant"];

  const seed = fromDate.getFullYear() * 1000 + Math.floor(daysSinceJ2000(fromDate) / 7);
  const rand = seededRandom(seed);

  const events: TransitEvent[] = [];
  let currentDate = new Date(fromDate);

  const interpreKeys = Object.keys(TRANSIT_INTERPRETATIONS);

  for (let i = 0; i < count; i++) {
    const offsetDays = Math.floor(rand() * 5) + (i * 4);
    const durationDays = Math.floor(rand() * 14) + 5;

    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() + offsetDays);
    const peakDate = new Date(startDate);
    peakDate.setDate(peakDate.getDate() + Math.floor(durationDays / 2));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const transitPlanet = transitingPlanets[Math.floor(rand() * transitingPlanets.length)];
    const natalPlanet = natalPlanets[Math.floor(rand() * natalPlanets.length)];
    const aspect = aspects[Math.floor(rand() * aspects.length)];
    const intensity = intensities[Math.floor(rand() * intensities.length)];

    const key = `${transitPlanet}_${aspect}_${natalPlanet}`;
    const interpKey = interpreKeys[Math.floor(rand() * interpreKeys.length)];
    const interp = TRANSIT_INTERPRETATIONS[key] || TRANSIT_INTERPRETATIONS[interpKey];

    const currentPos = getPlanetaryPosition(transitPlanet, startDate);

    events.push({
      id: `transit_${i}_${seed}`,
      title: `${transitPlanet} ${aspect} natal ${natalPlanet}`,
      planet: transitPlanet,
      aspect,
      natalPlanet,
      sign: currentPos.sign,
      startDate,
      peakDate,
      endDate,
      theme: interp.theme,
      intensity,
      interpretation: interp.interpretation,
      opportunity: interp.opportunity,
    });

    currentDate = endDate;
  }

  return events;
}

export function generateThemeScores(chart: NatalChart, date: Date): ThemeScores {
  const days = daysSinceJ2000(date);
  const seed = Math.floor(days / 3);
  const rand = seededRandom(seed);

  const base: ThemeScores = {
    Agency: 0.5,
    Relational: 0.5,
    Structure: 0.5,
    Expression: 0.5,
    "Inner Life": 0.5,
  };

  const element = chart.dominantElement;
  if (element === "Fire") base.Agency += 0.1;
  if (element === "Earth") base.Structure += 0.1;
  if (element === "Air") base.Expression += 0.1;
  if (element === "Water") { base.Relational += 0.1; base["Inner Life"] += 0.1; }

  const sunSign = chart.sun;
  const sunElement = ELEMENTS[sunSign];

  for (const key of Object.keys(base) as (keyof ThemeScores)[]) {
    const fluctuation = (rand() - 0.45) * 0.35;
    base[key] = Math.max(0.1, Math.min(0.95, base[key] + fluctuation));
  }

  if (sunElement === "Fire") base.Agency = Math.min(0.95, base.Agency + 0.08);
  if (sunElement === "Earth") base.Structure = Math.min(0.95, base.Structure + 0.08);
  if (sunElement === "Air") base.Expression = Math.min(0.95, base.Expression + 0.08);
  if (sunElement === "Water") base["Inner Life"] = Math.min(0.95, base["Inner Life"] + 0.08);

  return base;
}

export function getDailyCosmicWeather(date: Date): {
  headline: string;
  summary: string;
  moonPhase: string;
  moonPhaseIcon: string;
  voidOfCourse: boolean;
  activeWindows: number;
} {
  const days = daysSinceJ2000(date);
  const moonCycle = days % 29.53;
  const moonPhaseIndex = Math.floor(moonCycle / (29.53 / 8));

  const phases = [
    { name: "New Moon", icon: "🌑" },
    { name: "Waxing Crescent", icon: "🌒" },
    { name: "First Quarter", icon: "🌓" },
    { name: "Waxing Gibbous", icon: "🌔" },
    { name: "Full Moon", icon: "🌕" },
    { name: "Waning Gibbous", icon: "🌖" },
    { name: "Last Quarter", icon: "🌗" },
    { name: "Waning Crescent", icon: "🌘" },
  ];

  const phase = phases[moonPhaseIndex % 8];
  const seed = Math.floor(days);
  const rand = seededRandom(seed);

  const headlines = [
    "Expansive currents favor bold moves",
    "Consolidation brings lasting gains",
    "Quicksilver energy sharpens the mind",
    "Depth calls beneath the surface",
    "A day for strategic patience",
    "Creative fires burn bright",
    "The field opens for connection",
    "Inner clarity precedes outer action",
    "Transformative pressure yields diamonds",
    "Gentle energy supports reflection",
  ];

  const summaries = [
    "The planetary weather today supports focused effort with emotional openness. Avoid forcing outcomes—allow the current to carry you.",
    "A potent window for meaningful work opens this morning. The afternoon brings relational warmth worth investing in.",
    "Mental agility is your asset today. Communication flows easily, making this an ideal time for important exchanges.",
    "Depth is available for those willing to look inward. Surface matters can wait; the interior work is what counts now.",
    "Today rewards patience and craftsmanship over speed. What you complete with care today will last.",
    "Your creative instincts are unusually sharp. Trust the first impulse before the critic arrives.",
    "Connection is the theme. Reach out to those who matter; the field is receptive and warm.",
    "A quiet window for recalibration. The most important action today may be deliberate rest.",
  ];

  return {
    headline: headlines[Math.floor(rand() * headlines.length)],
    summary: summaries[Math.floor(rand() * summaries.length)],
    moonPhase: phase.name,
    moonPhaseIcon: phase.icon,
    voidOfCourse: rand() < 0.15,
    activeWindows: Math.floor(rand() * 3) + 1,
  };
}

export const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Chiron: "⚷",
  NorthNode: "☊",
  SouthNode: "☋",
};

export const SIGN_GLYPHS: Record<ZodiacSign, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋",
  Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏",
  Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

export const SIGN_KEYWORDS: Record<ZodiacSign, string[]> = {
  Aries: ["initiative", "courage", "fire"],
  Taurus: ["stability", "beauty", "earth"],
  Gemini: ["curiosity", "wit", "air"],
  Cancer: ["nurture", "intuition", "water"],
  Leo: ["vitality", "leadership", "fire"],
  Virgo: ["precision", "service", "earth"],
  Libra: ["balance", "harmony", "air"],
  Scorpio: ["transformation", "depth", "water"],
  Sagittarius: ["expansion", "truth", "fire"],
  Capricorn: ["mastery", "structure", "earth"],
  Aquarius: ["innovation", "community", "air"],
  Pisces: ["dissolution", "compassion", "water"],
};

export const ASPECT_COLORS: Record<Aspect, string> = {
  Conjunction: "#D4AF37",
  Trine: "#3EB8A8",
  Sextile: "#5B7FE0",
  Square: "#D85050",
  Opposition: "#D89070",
};

export const DIGNITY_COLORS: Record<string, string> = {
  domicile: "#3EB8A8",
  exaltation: "#D4AF37",
  detriment: "#D85050",
  fall: "#8B4513",
  peregrine: "#6B7280",
};

export const INTENSITY_LABELS: Record<TransitEvent["intensity"], string> = {
  subtle: "Subtle",
  moderate: "Moderate",
  significant: "Significant",
};

export const HOUSE_TOPICS: Record<number, { title: string; keywords: string[] }> = {
  1: { title: "Identity", keywords: ["self", "appearance", "beginnings"] },
  2: { title: "Resources", keywords: ["money", "values", "possessions"] },
  3: { title: "Communication", keywords: ["mind", "siblings", "short travel"] },
  4: { title: "Home", keywords: ["roots", "family", "foundation"] },
  5: { title: "Creativity", keywords: ["joy", "children", "romance"] },
  6: { title: "Service", keywords: ["work", "health", "daily life"] },
  7: { title: "Partnership", keywords: ["relationships", "contracts", "others"] },
  8: { title: "Transformation", keywords: ["death", "shared resources", "power"] },
  9: { title: "Wisdom", keywords: ["philosophy", "travel", "higher mind"] },
  10: { title: "Vocation", keywords: ["career", "reputation", "authority"] },
  11: { title: "Community", keywords: ["friends", "ideals", "future"] },
  12: { title: "Mystery", keywords: ["solitude", "karma", "hidden"] },
};
