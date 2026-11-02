import { z } from 'zod';

function utcMillis(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return y > 0 && new Date(utcMillis(y, m, d)).toISOString().slice(0, 10) === value;
}
function validZone(zone: string) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; }
  catch { return false; }
}

/** Versioned extension of the spec intake; no legacy noon/UTC/coordinate defaults. */
export const birthIntakeSchema = z.object({
  schema_version: z.literal('1.1.0'),
  subject_id: z.string().trim().min(1),
  birth_date: z.string().refine(validDate, 'Use a valid Gregorian date YYYY-MM-DD'),
  birth_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable(),
  birth_time_confidence: z.enum(['exact', 'approximate', 'unknown']),
  time_uncertainty_minutes: z.number().finite().positive().max(1440).nullable(),
  birth_source: z.enum(['certificate', 'family_memory', 'self_report', 'unknown']),
  birth_location: z.object({
    label: z.string().trim().min(1),
    latitude: z.number().finite().min(-90).max(90).nullable(),
    longitude: z.number().finite().min(-180).max(180).nullable(),
    iana_timezone: z.string().refine(validZone, 'Unsupported IANA timezone').nullable(),
    geocoding_source: z.string().trim().min(1).nullable(),
  }).strict(),
  ambiguous_time_choice: z.enum(['earlier', 'later']).nullable(),
  consent: z.object({
    local_storage: z.literal(true),
    cloud_sync: z.boolean(),
    ai_processing: z.boolean(),
    journal_calibration: z.boolean(),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  const unknown = value.birth_time_confidence === 'unknown';
  if (unknown !== (value.birth_time === null)) {
    ctx.addIssue({ code: 'custom', path: ['birth_time'], message: 'Unknown time must be null; known time must be explicit' });
  }
  if ((value.birth_time_confidence === 'approximate') !== (value.time_uncertainty_minutes !== null)) {
    ctx.addIssue({ code: 'custom', path: ['time_uncertainty_minutes'], message: 'Only approximate time requires a positive uncertainty interval' });
  }
  if (unknown && value.ambiguous_time_choice !== null) {
    ctx.addIssue({ code: 'custom', path: ['ambiguous_time_choice'], message: 'An unknown time cannot choose a UTC instant' });
  }
});
export type BirthIntake = z.infer<typeof birthIntakeSchema>;

export type BirthResolution = {
  status: 'resolved' | 'unknown_time' | 'unresolved_location' | 'nonexistent_time' | 'ambiguous_time';
  intake: BirthIntake;
  utc: string | null;
  candidates: string[];
  /** Data eligibility only: this does NOT certify any calculation engine. */
  precise_houses_eligible: boolean;
  timezone_runtime: string;
};

/** Resolve wall time by enumerating observed offsets and checking exact round trips.
 * Handles DST gaps, repeated hours, half-hour changes and date-line skips.
 * Uses host Intl data. Native runtime parity and pinned tzdb remain release gates.
 */
export function resolveBirthIntake(raw: unknown, timezoneRuntime: string): BirthResolution {
  const intake = birthIntakeSchema.parse(raw);
  if (!timezoneRuntime.trim()) throw new Error('Timezone runtime provenance is required');
  const result: BirthResolution = {
    status: 'unresolved_location', intake, utc: null, candidates: [],
    precise_houses_eligible: false, timezone_runtime: timezoneRuntime,
  };
  if (intake.birth_time === null) return { ...result, status: 'unknown_time' };
  const location = intake.birth_location;
  if (location.latitude === null || location.longitude === null || location.iana_timezone === null) return result;
  const [y, m, d] = intake.birth_date.split('-').map(Number);
  const [h, min, sec = 0] = intake.birth_time.split(':').map(Number);
  const wall = utcMillis(y, m, d, h, min, sec);
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone: location.iana_timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const localMillis = (ms: number) => {
    const parts = formatter.formatToParts(new Date(ms));
    const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
    return utcMillis(part('year'), part('month'), part('day'), part('hour'), part('minute'), part('second'));
  };
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6) {
    const probe = wall + hours * 3600000;
    offsets.add(localMillis(probe) - probe);
  }
  const candidates = [...offsets].map(offset => wall - offset)
    .filter(ms => localMillis(ms) === wall).sort((a, b) => a - b)
    .map(ms => new Date(ms).toISOString());
  if (!candidates.length) return { ...result, status: 'nonexistent_time' };
  if (candidates.length > 1 && !intake.ambiguous_time_choice) {
    return { ...result, status: 'ambiguous_time', candidates };
  }
  const utc = intake.ambiguous_time_choice === 'later' ? candidates.at(-1)! : candidates[0];
  return { ...result, status: 'resolved', candidates, utc,
    precise_houses_eligible: intake.birth_time_confidence === 'exact' };
}
