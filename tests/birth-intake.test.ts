import { test } from 'node:test';
import assert from 'node:assert/strict';
import { birthIntakeSchema, resolveBirthIntake } from '../lib/birth-intake';

const base = {
  schema_version: '1.1.0', subject_id: 'fixture', birth_date: '1991-11-06',
  birth_time: '12:34:56', birth_time_confidence: 'exact', time_uncertainty_minutes: null,
  birth_source: 'certificate', ambiguous_time_choice: null,
  birth_location: { label: 'Oakland', latitude: 37.8, longitude: -122.27,
    iana_timezone: 'America/Los_Angeles', geocoding_source: 'test fixture' },
  consent: { local_storage: true, cloud_sync: false, ai_processing: false, journal_calibration: false },
};
const resolve = (changes = {}) => resolveBirthIntake({ ...base, ...changes }, `Node ${process.version}; ICU ${process.versions.icu}; tz ${process.versions.tz}`);

test('preserves seconds and resolves a historical local date', () => {
  const value = resolve();
  assert.equal(value.utc, '1991-11-06T20:34:56.000Z');
  assert.equal(value.precise_houses_eligible, true);
  assert.equal(value.intake.consent.ai_processing, false);
});
test('unknown time never becomes noon or a calculated instant', () => {
  const value = resolve({ birth_time: null, birth_time_confidence: 'unknown' });
  assert.equal(value.utc, null); assert.equal(value.status, 'unknown_time');
  assert.equal(value.precise_houses_eligible, false); assert.deepEqual(value.candidates, []);
});
test('approximate time retains uncertainty and suppresses precise houses', () => {
  const value = resolve({ birth_time_confidence: 'approximate', time_uncertainty_minutes: 30 });
  assert.equal(value.status, 'resolved'); assert.equal(value.precise_houses_eligible, false);
});
for (const field of ['latitude', 'longitude', 'iana_timezone']) {
  test(`missing ${field} blocks resolution without zero/UTC substitution`, () => {
    assert.equal(resolve({ birth_location: { ...base.birth_location, [field]: null } }).status, 'unresolved_location');
  });
}
test('actual zero coordinates are valid', () => {
  assert.equal(resolve({ birth_location: { ...base.birth_location, latitude: 0, longitude: 0 } }).status, 'resolved');
});
for (const [date, time, zone, expected] of [
  ['2024-03-10','02:30','America/Los_Angeles','nonexistent_time'],
  ['2024-11-03','01:30','America/Los_Angeles','ambiguous_time'],
  ['2024-04-07','01:45','Australia/Lord_Howe','ambiguous_time'],
  ['2011-12-30','12:00','Pacific/Apia','nonexistent_time'],
]) {
  test(`${zone} ${date} ${time} is ${expected}`, () => {
    const value = resolve({ birth_date: date, birth_time: time, birth_location: { ...base.birth_location, iana_timezone: zone } });
    assert.equal(value.status, expected); assert.equal(value.utc, null);
  });
}
test('repeated hour requires an explicit earlier/later choice', () => {
  const changes = { birth_date: '2024-11-03', birth_time: '01:30' };
  assert.equal(resolve({ ...changes, ambiguous_time_choice: 'earlier' }).utc, '2024-11-03T08:30:00.000Z');
  assert.equal(resolve({ ...changes, ambiguous_time_choice: 'later' }).utc, '2024-11-03T09:30:00.000Z');
});
test('time after spring transition resolves using the new offset', () => {
  assert.equal(resolve({ birth_date: '2024-03-10', birth_time: '03:30' }).utc, '2024-03-10T10:30:00.000Z');
});
test('fractional timezone and leap day are preserved', () => {
  assert.equal(resolve({ birth_date: '2000-02-29', birth_time: '00:00', birth_location: { ...base.birth_location, iana_timezone: 'Asia/Kolkata' } }).utc, '2000-02-28T18:30:00.000Z');
});
for (const changes of [
  { birth_date: '2023-02-29' }, { birth_date: '2024-04-31' }, { birth_time: '24:00' },
  { birth_time: null }, { birth_time_confidence: 'unknown' },
  { birth_time_confidence: 'approximate' }, { time_uncertainty_minutes: -1 },
  { birth_location: { ...base.birth_location, latitude: NaN } },
  { birth_location: { ...base.birth_location, longitude: 181 } },
  { birth_location: { ...base.birth_location, iana_timezone: 'Not/AZone' } },
  { consent: { ...base.consent, local_storage: false } },
]) {
  test(`rejects invalid intake ${JSON.stringify(changes)}`, () => {
    assert.equal(birthIntakeSchema.safeParse({ ...base, ...changes }).success, false);
  });
}
test('does not accept unversioned or unexpected legacy fields', () => {
  assert.throws(() => resolve({ birthHour: 12 }));
  assert.throws(() => resolve({ schema_version: '1.0.0' }));
});
test('provenance cannot be omitted', () => assert.throws(() => resolveBirthIntake(base, '')));
