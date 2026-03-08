import * as ephemeris from "ephemeris";
import type {
  ZodiacSign, Body, AspectType, PlanetState, HouseState,
  AspectEdge, DignityState, AngularityState, RuleshipEdge,
  Angles, WesternChart, DerivedBundle, Reliability, ReliabilityFlag,
  CalcConfig, BirthRecord, CanonicalOutput, CalculatorProvenance,
  OrbPolicy, DignityStatus, AngularityClass,
  TzResolution,
} from "./canonical-types";

function getUTCOffsetMs(utcDate: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(utcDate);
  const get = (type: string) => {
    const val = parseInt(parts.find(p => p.type === type)?.value || "0");
    return type === "hour" && val === 24 ? 0 : val;
  };
  const localAsUTC = new Date(Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour"), get("minute"), get("second"),
  ));
  return localAsUTC.getTime() - utcDate.getTime();
}

interface LocalToUTCResult {
  utc: Date;
  tz_resolution: TzResolution;
}

function localToUTC(
  localDate: string,
  localTime: string | null,
  timezone: string,
): LocalToUTCResult {
  if (localTime === null) {
    const utc = localToUTCCore(localDate, "12:00:00", timezone);
    return { utc, tz_resolution: "time_unknown" };
  }

  const [y, mo, d] = localDate.split("-").map(Number);
  const timeParts = localTime.split(":").map(Number);
  const [h, m, s] = [timeParts[0], timeParts[1], timeParts[2] || 0];
  const localMs = Date.UTC(y, mo - 1, d, h, m, s);

  const utc = localToUTCCore(localDate, localTime, timezone);

  const offsetAtResult = getUTCOffsetMs(utc, timezone);
  const roundTripMs = utc.getTime() + offsetAtResult;

  if (roundTripMs !== localMs) {
    return { utc, tz_resolution: "invalid" };
  }

  for (const delta of [-1800000, 1800000, -3600000, 3600000, -5400000, 5400000]) {
    const probe = new Date(utc.getTime() + delta);
    const offsetProbe = getUTCOffsetMs(probe, timezone);
    const probeLocal = probe.getTime() + offsetProbe;
    if (probeLocal === localMs && offsetProbe !== offsetAtResult) {
      return { utc, tz_resolution: "ambiguous" };
    }
  }

  return { utc, tz_resolution: "ok" };
}

function localToUTCCore(
  localDate: string,
  localTime: string,
  timezone: string,
): Date {
  const [y, mo, d] = localDate.split("-").map(Number);
  const timeParts = localTime.split(":").map(Number);
  const [h, m, s] = [timeParts[0], timeParts[1], timeParts[2] || 0];

  const guess = new Date(Date.UTC(y, mo - 1, d, h, m, s));
  const offset = getUTCOffsetMs(guess, timezone);
  return new Date(guess.getTime() - offset);
}

const SIGNS: ZodiacSign[] = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const BODY_ORDER: Body[] = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
  "Chiron",
];

const BODY_KEY_MAP: Record<string, string> = {
  Sun: "sun", Moon: "moon", Mercury: "mercury", Venus: "venus",
  Mars: "mars", Jupiter: "jupiter", Saturn: "saturn",
  Uranus: "uranus", Neptune: "neptune", Pluto: "pluto",
  Chiron: "chiron",
};

const ASPECT_ANGLES: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  quincunx: 150,
  opposition: 180,
};

const DEFAULT_ORB_POLICY: OrbPolicy = {
  name: "aethos_default_v1",
  major_aspects: {
    conjunction: 8,
    opposition: 8,
    trine: 7,
    square: 7,
    sextile: 6,
  },
};

const DEFAULT_CONFIG: CalcConfig = {
  zodiac_system: "tropical",
  house_system: "whole_sign",
  orb_policy: DEFAULT_ORB_POLICY,
  points_enabled: { lunar_nodes: false, chiron: true },
  include_velocity: true,
};

const DOMICILE: Record<string, ZodiacSign[]> = {
  Sun: ["Leo"],
  Moon: ["Cancer"],
  Mercury: ["Gemini", "Virgo"],
  Venus: ["Taurus", "Libra"],
  Mars: ["Aries", "Scorpio"],
  Jupiter: ["Sagittarius", "Pisces"],
  Saturn: ["Capricorn", "Aquarius"],
  Uranus: ["Aquarius"],
  Neptune: ["Pisces"],
  Pluto: ["Scorpio"],
  Chiron: [],
};

const EXALTATION: Record<string, ZodiacSign | null> = {
  Sun: "Aries",
  Moon: "Taurus",
  Mercury: "Virgo",
  Venus: "Pisces",
  Mars: "Capricorn",
  Jupiter: "Cancer",
  Saturn: "Libra",
  Uranus: null,
  Neptune: null,
  Pluto: null,
  Chiron: null,
};

const DETRIMENT: Record<string, ZodiacSign[]> = {
  Sun: ["Aquarius"],
  Moon: ["Capricorn"],
  Mercury: ["Sagittarius", "Pisces"],
  Venus: ["Aries", "Scorpio"],
  Mars: ["Taurus", "Libra"],
  Jupiter: ["Gemini", "Virgo"],
  Saturn: ["Cancer", "Leo"],
  Uranus: ["Leo"],
  Neptune: ["Virgo"],
  Pluto: ["Taurus"],
  Chiron: [],
};

const FALL: Record<string, ZodiacSign | null> = {
  Sun: "Libra",
  Moon: "Scorpio",
  Mercury: "Pisces",
  Venus: "Virgo",
  Mars: "Cancer",
  Jupiter: "Capricorn",
  Saturn: "Aries",
  Uranus: null,
  Neptune: null,
  Pluto: null,
  Chiron: null,
};

const SIGN_RULERS: Record<ZodiacSign, Body> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Mars",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
};

function normalizeAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

function lonToSign(lon: number): ZodiacSign {
  return SIGNS[Math.floor(normalizeAngle(lon) / 30)];
}

function lonToHouse(lon: number, ascLon: number): number {
  const offset = normalizeAngle(lon - ascLon);
  return Math.floor(offset / 30) + 1;
}

function degToRad(d: number): number { return d * Math.PI / 180; }
function radToDeg(r: number): number { return r * 180 / Math.PI; }

interface RawEphemerisBody {
  apparentLongitudeDd: number;
  is_retrograde?: boolean;
  geocentricDistanceKm?: number;
  raw?: {
    position?: {
      equinoxEclipticLonLat?: {
        longitude: number;
        latitude: number;
        distance: number;
      };
    };
  };
  position?: {
    equinoxEclipticLonLat?: {
      longitude: number;
      latitude: number;
      distance: number;
    };
  };
}

function getEphemerisResult(date: Date): Record<string, RawEphemerisBody> {
  const result = ephemeris.getAllPlanets(date, 0, 0, 0);
  return result.observed as Record<string, RawEphemerisBody>;
}

function extractBodyData(observed: Record<string, RawEphemerisBody>, body: Body): {
  lon: number; lat: number; distance_au: number;
} | null {
  const key = BODY_KEY_MAP[body];
  if (!key) return null;
  const data = observed[key];
  if (!data) return null;

  const lon = data.apparentLongitudeDd;
  let lat = 0;
  let distance_au = 0;

  const eqData = data.raw?.position?.equinoxEclipticLonLat
    || data.position?.equinoxEclipticLonLat;
  if (eqData) {
    lat = eqData.latitude || 0;
    distance_au = eqData.distance || 0;
  }

  return { lon, lat, distance_au };
}

function computeAscendant(date: Date, birthHour: number, geoLat: number, geoLon: number = 0): number {
  const j2000 = new Date("2000-01-01T12:00:00Z");
  const d = (date.getTime() - j2000.getTime()) / (1000 * 60 * 60 * 24);
  const T = d / 36525.0;

  const GMST0 = normalizeAngle(280.46061837 + 360.98564736629 * d);
  const LST = normalizeAngle(GMST0 + birthHour * 15 + geoLon);

  const obliquity = 23.4393 - 0.0130 * T;
  const oblRad = degToRad(obliquity);
  const LSTRad = degToRad(LST);
  const latRad = degToRad(geoLat);

  const ascRad = Math.atan2(
    Math.cos(LSTRad),
    -(Math.sin(LSTRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad))
  );
  return normalizeAngle(radToDeg(ascRad));
}

function computeMC(date: Date, birthHour: number, geoLon: number = 0): number {
  const j2000 = new Date("2000-01-01T12:00:00Z");
  const d = (date.getTime() - j2000.getTime()) / (1000 * 60 * 60 * 24);
  const T = d / 36525.0;

  const GMST0 = normalizeAngle(280.46061837 + 360.98564736629 * d);
  const LST = normalizeAngle(GMST0 + birthHour * 15 + geoLon);

  const obliquity = 23.4393 - 0.0130 * T;
  const oblRad = degToRad(obliquity);
  const LSTRad = degToRad(LST);

  const mcRad = Math.atan2(
    Math.sin(LSTRad),
    Math.cos(LSTRad) * Math.cos(oblRad)
  );
  return normalizeAngle(radToDeg(mcRad));
}

function buildBodies(
  date: Date,
  ascLon: number,
  config: CalcConfig,
): PlanetState[] {
  const observed = getEphemerisResult(date);
  const prevDate = new Date(date.getTime() - 86400000);
  const nextDate = new Date(date.getTime() + 86400000);
  const observedPrev = getEphemerisResult(prevDate);
  const observedNext = getEphemerisResult(nextDate);

  const enabledBodies = BODY_ORDER.filter(b => {
    if (b === "Chiron") return config.points_enabled.chiron;
    return true;
  });

  const bodies: PlanetState[] = [];

  for (const body of enabledBodies) {
    const current = extractBodyData(observed, body);
    if (!current) continue;

    const prev = extractBodyData(observedPrev, body);
    const next = extractBodyData(observedNext, body);

    let speed_lon = 0;
    let speed_lat = 0;
    let speed_dist = 0;

    if (prev && next) {
      let dlon = next.lon - prev.lon;
      if (dlon > 180) dlon -= 360;
      if (dlon < -180) dlon += 360;
      speed_lon = dlon / 2;

      speed_lat = (next.lat - prev.lat) / 2;
      speed_dist = (next.distance_au - prev.distance_au) / 2;
    }

    const retrograde = speed_lon < 0 && body !== "Sun" && body !== "Moon";

    const sign = lonToSign(current.lon);
    const house = lonToHouse(current.lon, ascLon);

    bodies.push({
      body,
      lon: Math.round(current.lon * 1000) / 1000,
      lat: Math.round(current.lat * 1000) / 1000,
      distance_au: Math.round(current.distance_au * 1000000) / 1000000,
      speed_lon: Math.round(speed_lon * 10000) / 10000,
      speed_lat: Math.round(speed_lat * 10000) / 10000,
      speed_dist: Math.round(speed_dist * 10000000) / 10000000,
      retrograde,
      sign,
      house,
    });
  }

  return bodies;
}

function buildHouses(ascLon: number): HouseState[] {
  const ascSignIndex = Math.floor(normalizeAngle(ascLon) / 30);
  const houses: HouseState[] = [];

  for (let i = 0; i < 12; i++) {
    const signIndex = (ascSignIndex + i) % 12;
    const start_lon = signIndex * 30;
    const end_lon = (signIndex + 1) * 30;
    houses.push({
      house: i + 1,
      sign: SIGNS[signIndex],
      start_lon,
      end_lon: end_lon % 360,
      cusp_lon: start_lon,
    });
  }

  return houses;
}

function buildAspects(bodies: PlanetState[], config: CalcConfig): AspectEdge[] {
  const aspects: AspectEdge[] = [];
  const orbPolicy = config.orb_policy.major_aspects;
  const quincunxOrb = 3;
  const majorAspects: { type: AspectType; angle: number; maxOrb: number }[] = [
    { type: "conjunction", angle: 0, maxOrb: orbPolicy.conjunction },
    { type: "opposition", angle: 180, maxOrb: orbPolicy.opposition },
    { type: "trine", angle: 120, maxOrb: orbPolicy.trine },
    { type: "square", angle: 90, maxOrb: orbPolicy.square },
    { type: "sextile", angle: 60, maxOrb: orbPolicy.sextile },
    { type: "quincunx", angle: 150, maxOrb: quincunxOrb },
  ];

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];

      let separation = Math.abs(a.lon - b.lon);
      if (separation > 180) separation = 360 - separation;

      for (const asp of majorAspects) {
        const orb = Math.abs(separation - asp.angle);
        if (orb <= asp.maxOrb) {
          const applying = determineApplying(a, b, asp.angle);
          const strength = Math.max(0, 1 - orb / asp.maxOrb);

          aspects.push({
            body_a: a.body,
            body_b: b.body,
            aspect: asp.type,
            exact_angle: asp.angle,
            separation: Math.round(separation * 1000) / 1000,
            orb: Math.round(orb * 1000) / 1000,
            applying,
            strength: Math.round(strength * 1000) / 1000,
          });
          break;
        }
      }
    }
  }

  return aspects.sort((a, b) => b.strength - a.strength);
}

function determineApplying(a: PlanetState, b: PlanetState, aspectAngle: number): boolean {
  let sep = a.lon - b.lon;
  if (sep > 180) sep -= 360;
  if (sep < -180) sep += 360;

  const currentDist = Math.abs(Math.abs(sep) - aspectAngle);
  const speedDiff = a.speed_lon - b.speed_lon;
  let futureSep = sep + speedDiff * 0.1;
  if (futureSep > 180) futureSep -= 360;
  if (futureSep < -180) futureSep += 360;
  const futureDist = Math.abs(Math.abs(futureSep) - aspectAngle);

  return futureDist < currentDist;
}

function getDignity(body: Body, sign: ZodiacSign): DignityStatus {
  const bodyStr = body as string;
  if (DOMICILE[bodyStr]?.includes(sign)) return "domicile";
  if (EXALTATION[bodyStr] === sign) return "exaltation";
  if (DETRIMENT[bodyStr]?.includes(sign)) return "detriment";
  if (FALL[bodyStr] === sign) return "fall";
  return "peregrine";
}

function getAngularity(house: number): AngularityClass {
  if ([1, 4, 7, 10].includes(house)) return "angular";
  if ([2, 5, 8, 11].includes(house)) return "succedent";
  return "cadent";
}

function buildDerived(bodies: PlanetState[], houses: HouseState[], birthHour: number): DerivedBundle {
  const sect: "diurnal" | "nocturnal" = birthHour >= 6 && birthHour < 18 ? "diurnal" : "nocturnal";

  const dignities: DignityState[] = bodies.map(b => ({
    body: b.body,
    sign: b.sign,
    status: getDignity(b.body, b.sign),
  }));

  const angularity: AngularityState[] = bodies.map(b => ({
    body: b.body,
    class: getAngularity(b.house),
  }));

  const rulerships: RuleshipEdge[] = [];
  for (const house of houses) {
    const ruler = SIGN_RULERS[house.sign];
    if (ruler) {
      rulerships.push({
        from: `House${house.house}`,
        to: ruler,
        reason: "sign_ruler",
      });
    }
  }

  return { sect, dignities, angularity, rulerships };
}

function buildReliability(birthHour: number, timeAccuracy?: number): Reliability | undefined {
  const flags: ReliabilityFlag[] = [];

  if (timeAccuracy !== undefined && timeAccuracy > 30) {
    flags.push("HOUSES_UNRELIABLE");
    flags.push("ANGLES_UNRELIABLE");
  }

  if (timeAccuracy !== undefined && timeAccuracy >= 120) {
    flags.push("MOON_SIGN_EDGE_CASE");
    flags.push("EVENT_WINDOWS_UNRELIABLE");
  }

  if (flags.length === 0 && timeAccuracy === undefined) return undefined;

  return {
    time_uncertainty_minutes: timeAccuracy,
    flags: flags.length > 0 ? flags : undefined,
  };
}

function dateToJulianDay(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  let yr = y;
  let mo = m;
  if (mo <= 2) { yr -= 1; mo += 12; }

  const A = Math.floor(yr / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (yr + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + h / 24 + B - 1524.5;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

export interface CanonicalInput {
  name: string;
  birthDate: string;
  birthHour: number;
  birthCity: string;
  geoLat?: number;
  geoLon?: number;
  birthTimezone?: string;
  birthLocalTime?: string;
  timeAccuracy?: number;
  birthSource?: "certificate" | "family_memory" | "approx";
}

export interface GoldenInput {
  schema_version: string;
  subject_id: string;
  birth: {
    birth_source?: "certificate" | "family_memory" | "approx";
    time_accuracy_minutes?: number;
    birth_local_date: string;
    birth_local_time: string | null;
    birth_timezone: string;
    geo: {
      lat: number;
      lon: number;
      place_label: string;
    };
  };
  config: CalcConfig;
  meta?: Record<string, unknown>;
}

export function goldenInputToCanonicalInput(gi: GoldenInput): CanonicalInput {
  return {
    name: gi.subject_id,
    birthDate: gi.birth.birth_local_date,
    birthHour: gi.birth.birth_local_time
      ? parseInt(gi.birth.birth_local_time.split(":")[0])
      : 12,
    birthCity: gi.birth.geo.place_label,
    geoLat: gi.birth.geo.lat,
    geoLon: gi.birth.geo.lon,
    birthTimezone: gi.birth.birth_timezone,
    birthLocalTime: gi.birth.birth_local_time || undefined,
    timeAccuracy: gi.birth.time_accuracy_minutes,
    birthSource: gi.birth.birth_source,
  };
}

export function generateCanonicalChart(
  input: CanonicalInput,
  config: CalcConfig = DEFAULT_CONFIG,
): CanonicalOutput {
  const dateStr = input.birthDate;
  const timezone = input.birthTimezone || "UTC";
  const timeKnown = !!input.birthLocalTime;
  const localTime = input.birthLocalTime
    || `${String(input.birthHour).padStart(2, "0")}:00:00`;

  const { utc: utcDate, tz_resolution } = localToUTC(
    dateStr,
    timeKnown ? localTime : null,
    timezone,
  );

  const geoLat = input.geoLat ?? 0;
  const geoLon = input.geoLon ?? 0;

  const utcHour = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60 + utcDate.getUTCSeconds() / 3600;

  const julianDay = dateToJulianDay(utcDate);
  const ascLon = computeAscendant(utcDate, utcHour, geoLat, geoLon);
  const mcLon = computeMC(utcDate, utcHour, geoLon);
  const descLon = normalizeAngle(ascLon + 180);
  const icLon = normalizeAngle(mcLon + 180);

  const angles: Angles = {
    asc_lon: Math.round(ascLon * 1000) / 1000,
    mc_lon: Math.round(mcLon * 1000) / 1000,
    desc_lon: Math.round(descLon * 1000) / 1000,
    ic_lon: Math.round(icLon * 1000) / 1000,
  };

  const bodies = buildBodies(utcDate, ascLon, config);
  const houses = buildHouses(ascLon);
  const aspects = buildAspects(bodies, config);

  const localHour = parseInt(localTime.split(":")[0]);
  const derived = buildDerived(bodies, houses, localHour);
  const reliability = buildReliability(localHour, input.timeAccuracy);

  const birthRecord: BirthRecord = {
    subject_id: input.name,
    birth_source: input.birthSource,
    time_accuracy_minutes: input.timeAccuracy,
    birth_local_date: dateStr,
    birth_local_time: localTime.length === 5 ? localTime + ":00" : localTime,
    birth_timezone: timezone,
    birth_utc_datetime: utcDate.toISOString(),
    julian_day: Math.round(julianDay * 1000000) / 1000000,
    geo: {
      lat: geoLat,
      lon: geoLon,
      place_label: input.birthCity,
    },
    tz_invalid_time_policy: "normalize_forward",
    tz_ambiguous_time_policy: "prefer_earliest",
    tz_resolution,
  };

  const configHash = simpleHash(JSON.stringify(config));

  const calculator: CalculatorProvenance = {
    calculator_version: "1.0.0",
    build_hash: "aethos-moshier-v1",
    ephemeris: {
      provider: "moshier",
      swe_version: "2.2.0",
      fileset: "Moshier analytical ephemeris (built-in)",
    },
    generated_at_utc: new Date().toISOString(),
    config_hash: configHash,
  };

  const westernChart: WesternChart = {
    zodiac: config.zodiac_system,
    house_system: config.house_system,
    angles,
    bodies,
    houses,
  };

  return {
    schema_version: "1.0.0",
    calculator,
    birth_record: birthRecord,
    config,
    western_chart: westernChart,
    aspects,
    derived,
    reliability,
  };
}

export function generateSimpleChart(
  birthDate: Date,
  birthHour: number = 12,
  geoLat: number = 0,
  geoLon: number = 0,
): {
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
} {
  const observed = getEphemerisResult(birthDate);
  const ascLon = computeAscendant(birthDate, birthHour, geoLat, geoLon);
  const mcLon = computeMC(birthDate, birthHour, geoLon);

  const bodies = buildBodies(birthDate, ascLon, DEFAULT_CONFIG);
  const houses = buildHouses(ascLon);
  const aspects = buildAspects(bodies, DEFAULT_CONFIG);

  const getSign = (bodyName: string): ZodiacSign => {
    const b = bodies.find(p => p.body === bodyName);
    return b?.sign ?? "Aries";
  };

  const sun = getSign("Sun");
  const moon = getSign("Moon");
  const ascendant = lonToSign(ascLon);
  const mercury = getSign("Mercury");
  const venus = getSign("Venus");
  const mars = getSign("Mars");
  const jupiter = getSign("Jupiter");
  const saturn = getSign("Saturn");

  const ELEMENTS: Record<ZodiacSign, "Fire" | "Earth" | "Air" | "Water"> = {
    Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
    Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
    Gemini: "Air", Libra: "Air", Aquarius: "Air",
    Cancer: "Water", Scorpio: "Water", Pisces: "Water",
  };

  const signCounts: Partial<Record<ZodiacSign, number>> = {};
  for (const s of [sun, moon, ascendant, mercury, venus, mars, jupiter, saturn]) {
    signCounts[s] = (signCounts[s] || 0) + 1;
  }
  const stelliumSign = Object.entries(signCounts).find(([, v]) => v >= 3)?.[0] as ZodiacSign | undefined;

  const elementCounts: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  for (const s of [sun, moon, mercury, venus, mars]) {
    elementCounts[ELEMENTS[s]]++;
  }
  const dominantElement = Object.entries(elementCounts)
    .sort((a, b) => b[1] - a[1])[0][0] as "Fire" | "Earth" | "Air" | "Water";

  const sect: "diurnal" | "nocturnal" = birthHour >= 6 && birthHour < 18 ? "diurnal" : "nocturnal";

  const dignities: DignityState[] = bodies.map(b => ({
    body: b.body,
    sign: b.sign,
    status: getDignity(b.body, b.sign),
  }));

  return {
    sun, moon, ascendant, mercury, venus, mars, jupiter, saturn,
    stellium: stelliumSign || null,
    dominantElement,
    sect,
    bodies,
    aspects,
    angles: {
      asc_lon: Math.round(ascLon * 1000) / 1000,
      mc_lon: Math.round(mcLon * 1000) / 1000,
      desc_lon: Math.round(normalizeAngle(ascLon + 180) * 1000) / 1000,
      ic_lon: Math.round(normalizeAngle(mcLon + 180) * 1000) / 1000,
    },
    houses,
    dignities,
  };
}

export { DEFAULT_CONFIG, DEFAULT_ORB_POLICY, SIGNS, SIGN_RULERS, lonToSign, normalizeAngle };
