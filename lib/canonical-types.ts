export type ZodiacSign =
  | "Aries" | "Taurus" | "Gemini" | "Cancer"
  | "Leo" | "Virgo" | "Libra" | "Scorpio"
  | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";

export type Body =
  | "Sun" | "Moon" | "Mercury" | "Venus" | "Mars"
  | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto"
  | "NorthNode" | "SouthNode" | "Chiron";

export type AspectType =
  | "conjunction" | "opposition" | "trine" | "square" | "sextile" | "quincunx";

export type HouseSystem = "whole_sign" | "placidus" | "koch" | "regiomontanus";

export type DignityStatus = "domicile" | "exaltation" | "detriment" | "fall" | "peregrine";

export type AngularityClass = "angular" | "succedent" | "cadent";

export interface PlanetState {
  body: Body;
  lon: number;
  lat: number;
  distance_au: number;
  speed_lon: number;
  speed_lat: number;
  speed_dist: number;
  retrograde: boolean;
  sign: ZodiacSign;
  house: number;
}

export interface HouseState {
  house: number;
  sign: ZodiacSign;
  start_lon: number;
  end_lon: number;
  cusp_lon: number;
}

export interface AspectEdge {
  body_a: Body;
  body_b: Body;
  aspect: AspectType;
  exact_angle: number;
  separation: number;
  orb: number;
  applying: boolean;
  strength: number;
}

export interface DignityState {
  body: Body;
  sign: ZodiacSign;
  status: DignityStatus;
}

export interface AngularityState {
  body: Body;
  class: AngularityClass;
}

export interface RuleshipEdge {
  from: string;
  to: Body;
  reason: "sign_ruler" | "exaltation_ruler" | "triplicity_ruler" | "term_ruler" | "face_ruler";
}

export interface OrbPolicy {
  name: string;
  major_aspects: {
    conjunction: number;
    opposition: number;
    trine: number;
    square: number;
    sextile: number;
  };
}

export type Ayanamsa = "lahiri" | "raman" | "fagan_bradley";

export interface CalcConfig {
  zodiac_system: "tropical" | "sidereal";
  ayanamsa?: Ayanamsa | null;
  house_system: HouseSystem;
  orb_policy: OrbPolicy;
  points_enabled: {
    lunar_nodes?: boolean | null;
    chiron?: boolean | null;
    asteroids?: string[] | null;
  };
  include_velocity?: boolean | null;
}

export interface BirthGeo {
  lat: number;
  lon: number;
  place_label?: string;
}

export type TzInvalidTimePolicy = "error" | "normalize_forward";
export type TzAmbiguousTimePolicy = "prefer_earliest" | "prefer_latest";
export type TzResolution = "ok" | "ambiguous" | "invalid" | "time_unknown";

export interface BirthRecord {
  subject_id: string;
  birth_source?: "certificate" | "family_memory" | "approx";
  time_accuracy_minutes?: number;
  birth_local_date: string;
  birth_local_time: string;
  birth_timezone: string;
  birth_utc_datetime: string;
  julian_day: number;
  delta_t_seconds?: number;
  geo: BirthGeo;
  tz_invalid_time_policy: TzInvalidTimePolicy;
  tz_ambiguous_time_policy: TzAmbiguousTimePolicy;
  tz_resolution: TzResolution;
}

export interface Angles {
  asc_lon: number;
  mc_lon: number;
  desc_lon?: number;
  ic_lon?: number;
}

export interface WesternChart {
  zodiac: "tropical" | "sidereal";
  house_system: HouseSystem;
  angles: Angles;
  bodies: PlanetState[];
  houses: HouseState[];
}

export interface DerivedBundle {
  sect: "diurnal" | "nocturnal";
  dignities: DignityState[];
  angularity: AngularityState[];
  rulerships?: RuleshipEdge[];
}

export type ReliabilityFlag =
  | "HOUSES_UNRELIABLE"
  | "ANGLES_UNRELIABLE"
  | "MOON_SIGN_EDGE_CASE"
  | "ASPECTS_PARTIALLY_UNRELIABLE"
  | "EVENT_WINDOWS_UNRELIABLE";

export interface Reliability {
  time_uncertainty_minutes?: number;
  flags?: ReliabilityFlag[];
}

export interface CalculatorProvenance {
  calculator_version: string;
  build_hash: string;
  ephemeris: {
    provider: string;
    swe_version: string;
    fileset: string;
  };
  generated_at_utc: string;
  config_hash: string;
}

export interface CanonicalOutput {
  schema_version: "1.0.0";
  calculator: CalculatorProvenance;
  birth_record: BirthRecord;
  config: CalcConfig;
  western_chart: WesternChart;
  aspects: AspectEdge[];
  derived: DerivedBundle;
  reliability?: Reliability;
}
