import * as fs from "fs";
import * as path from "path";
import {
  generateCanonicalChart,
  goldenInputToCanonicalInput,
  type GoldenInput,
} from "../../lib/canonical-calculator";

const GOLDENS_DIR = path.resolve(__dirname, "../../goldens");
const INPUTS_DIR = path.join(GOLDENS_DIR, "inputs");
const OUTPUTS_DIR = path.join(GOLDENS_DIR, "outputs");

interface TestResult {
  file: string;
  status: "pass" | "fail" | "error";
  issues: string[];
}

function loadJSON<T>(filepath: string): T {
  return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
}

function angDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360.0;
  return Math.min(d, 360.0 - d);
}

function compareBirthRecord(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  const expBR = (expected as { birth_record: Record<string, unknown> }).birth_record;
  const actBR = (actual as { birth_record: Record<string, unknown> }).birth_record;

  if (expBR.birth_utc_datetime !== actBR.birth_utc_datetime) {
    issues.push(`birth_record.birth_utc_datetime changed: ${expBR.birth_utc_datetime} -> ${actBR.birth_utc_datetime}`);
  }
  if (expBR.julian_day !== actBR.julian_day) {
    issues.push(`birth_record.julian_day changed: ${expBR.julian_day} -> ${actBR.julian_day}`);
  }
  if (expBR.tz_resolution !== actBR.tz_resolution) {
    issues.push(`birth_record.tz_resolution changed: ${expBR.tz_resolution} -> ${actBR.tz_resolution}`);
  }
  if (expBR.tz_invalid_time_policy !== actBR.tz_invalid_time_policy) {
    issues.push(`birth_record.tz_invalid_time_policy changed: ${expBR.tz_invalid_time_policy} -> ${actBR.tz_invalid_time_policy}`);
  }
  if (expBR.tz_ambiguous_time_policy !== actBR.tz_ambiguous_time_policy) {
    issues.push(`birth_record.tz_ambiguous_time_policy changed: ${expBR.tz_ambiguous_time_policy} -> ${actBR.tz_ambiguous_time_policy}`);
  }
  return issues;
}

function comparePlanets(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  lonTol: number = 0.0003,
): string[] {
  const issues: string[] = [];
  const expChart = expected as { western_chart: { bodies: Array<{ body: string; lon: number; retrograde: boolean; sign: string; house: number }> } };
  const actChart = actual as { western_chart: { bodies: Array<{ body: string; lon: number; retrograde: boolean; sign: string; house: number }> } };

  const expBodies = new Map(expChart.western_chart.bodies.map(b => [b.body, b]));
  const actBodies = new Map(actChart.western_chart.bodies.map(b => [b.body, b]));

  const expSet = new Set(expBodies.keys());
  const actSet = new Set(actBodies.keys());
  if (expSet.size !== actSet.size || [...expSet].some(k => !actSet.has(k))) {
    issues.push(`Body set mismatch: expected=[${[...expSet].sort()}] actual=[${[...actSet].sort()}]`);
    return issues;
  }

  for (const [body, exp] of expBodies) {
    const act = actBodies.get(body)!;
    const dlon = angDiff(exp.lon, act.lon);
    if (dlon > lonTol) {
      issues.push(`${body}.lon drift ${dlon.toFixed(6)} (tol ${lonTol}) exp=${exp.lon.toFixed(6)} act=${act.lon.toFixed(6)}`);
    }
    if (exp.retrograde !== act.retrograde) {
      issues.push(`${body}.retrograde changed: ${exp.retrograde} -> ${act.retrograde}`);
    }
    if (exp.sign !== act.sign) {
      issues.push(`${body}.sign changed: ${exp.sign} -> ${act.sign}`);
    }
    if (exp.house !== act.house) {
      issues.push(`${body}.house changed: ${exp.house} -> ${act.house}`);
    }
  }
  return issues;
}

function compareAngles(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  tol: number = 0.0003,
): string[] {
  const issues: string[] = [];
  const expAngles = (expected as { western_chart: { angles: Record<string, number> } }).western_chart.angles;
  const actAngles = (actual as { western_chart: { angles: Record<string, number> } }).western_chart.angles;

  for (const key of ["asc_lon", "mc_lon", "desc_lon", "ic_lon"]) {
    if (expAngles[key] !== undefined && actAngles[key] !== undefined) {
      const d = angDiff(expAngles[key], actAngles[key]);
      if (d > tol) {
        issues.push(`angles.${key} drift ${d.toFixed(6)} (tol ${tol}) exp=${expAngles[key].toFixed(6)} act=${actAngles[key].toFixed(6)}`);
      }
    }
  }
  return issues;
}

function compareAspects(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
  orbTol: number = 0.01,
): string[] {
  const issues: string[] = [];
  const expAspects = (expected as { aspects: Array<{ body_a: string; body_b: string; aspect: string; orb?: number }> }).aspects;
  const actAspects = (actual as { aspects: Array<{ body_a: string; body_b: string; aspect: string; orb?: number }> }).aspects;

  const makeKey = (a: { body_a: string; body_b: string; aspect: string }) =>
    [a.body_a, a.body_b].sort().join("|") + "|" + a.aspect;

  const expMap = new Map(expAspects.map(a => [makeKey(a), a]));
  const actMap = new Map(actAspects.map(a => [makeKey(a), a]));

  const expKeys = new Set(expMap.keys());
  const actKeys = new Set(actMap.keys());

  const missing = [...expKeys].filter(k => !actKeys.has(k));
  const extra = [...actKeys].filter(k => !expKeys.has(k));

  if (missing.length > 0) {
    issues.push(`aspects missing (${missing.length}): ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "..." : ""}`);
  }
  if (extra.length > 0) {
    issues.push(`aspects extra (${extra.length}): ${extra.slice(0, 10).join(", ")}${extra.length > 10 ? "..." : ""}`);
  }

  for (const key of [...expKeys].filter(k => actKeys.has(k))) {
    const eo = expMap.get(key)!.orb;
    const ao = actMap.get(key)!.orb;
    if (eo !== undefined && ao !== undefined && Math.abs(eo - ao) > orbTol) {
      issues.push(`aspect orb drift ${key}: exp=${eo.toFixed(4)} act=${ao.toFixed(4)} (tol ${orbTol})`);
    }
  }

  return issues;
}

function compareDerived(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  const expDerived = (expected as { derived: { sect: string } }).derived;
  const actDerived = (actual as { derived: { sect: string } }).derived;
  if (expDerived.sect !== actDerived.sect) {
    issues.push(`derived.sect changed: ${expDerived.sect} -> ${actDerived.sect}`);
  }
  return issues;
}

function compareReliability(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): string[] {
  const issues: string[] = [];
  const expRel = (expected as { reliability?: { flags?: string[] } }).reliability;
  const actRel = (actual as { reliability?: { flags?: string[] } }).reliability;

  const expFlags = (expRel?.flags || []).sort();
  const actFlags = (actRel?.flags || []).sort();

  if (JSON.stringify(expFlags) !== JSON.stringify(actFlags)) {
    issues.push(`reliability.flags changed: [${expFlags}] -> [${actFlags}]`);
  }
  return issues;
}

function compareCanonical(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): string[] {
  return [
    ...compareBirthRecord(expected, actual),
    ...comparePlanets(expected, actual),
    ...compareAngles(expected, actual),
    ...compareAspects(expected, actual),
    ...compareDerived(expected, actual),
    ...compareReliability(expected, actual),
  ];
}

function generateOutputForInput(inputPath: string): Record<string, unknown> {
  const gi = loadJSON<GoldenInput>(inputPath);
  const ci = goldenInputToCanonicalInput(gi);
  const output = generateCanonicalChart(ci, gi.config);
  return output as unknown as Record<string, unknown>;
}

function generateGoldens(): void {
  console.log("=== Generating Golden Outputs ===\n");

  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  const manifest = loadJSON<{ files: string[] }>(path.join(INPUTS_DIR, "manifest.json"));
  let count = 0;

  for (const inputFile of manifest.files) {
    const inputPath = path.join(INPUTS_DIR, inputFile);
    if (!fs.existsSync(inputPath)) {
      console.log(`  SKIP: ${inputFile} (not found)`);
      continue;
    }

    try {
      const output = generateOutputForInput(inputPath);
      const outFile = inputFile.replace(".input.json", ".canonical.json");
      const outPath = path.join(OUTPUTS_DIR, outFile);
      fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
      console.log(`  OK: ${outFile}`);
      count++;
    } catch (e) {
      console.log(`  ERROR: ${inputFile}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nGenerated ${count} golden outputs.`);
}

function runAllTests(): void {
  console.log("=== Golden Regression Tests ===\n");

  const manifest = loadJSON<{ files: string[] }>(path.join(INPUTS_DIR, "manifest.json"));
  const results: TestResult[] = [];
  let totalDrift = 0;

  for (const inputFile of manifest.files) {
    const baseName = inputFile.replace(".input.json", "");
    const expectedFile = baseName + ".canonical.json";
    const expectedPath = path.join(OUTPUTS_DIR, expectedFile);
    const inputPath = path.join(INPUTS_DIR, inputFile);

    try {
      const actual = generateOutputForInput(inputPath);

      if (fs.existsSync(expectedPath)) {
        const expected = loadJSON<Record<string, unknown>>(expectedPath);
        const issues = compareCanonical(expected, actual);

        if (issues.length > 0) {
          results.push({ file: baseName, status: "fail", issues });
          totalDrift += issues.length;
          console.log(`  [FAIL] ${baseName}`);
          for (const issue of issues) {
            console.log(`         - ${issue}`);
          }
        } else {
          results.push({ file: baseName, status: "pass", issues: [] });
          console.log(`  [PASS] ${baseName}: No drift`);
        }
      } else {
        results.push({ file: baseName, status: "pass", issues: [] });
        console.log(`  [SKIP] ${baseName}: No golden to compare`);
      }
    } catch (e) {
      results.push({
        file: baseName,
        status: "error",
        issues: [e instanceof Error ? e.message : String(e)],
      });
      console.log(`  [ERROR] ${baseName}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const errors = results.filter(r => r.status === "error").length;

  if (totalDrift > 0) {
    console.log(`\n=== DRIFT REPORT: ${totalDrift} issue(s) across ${failed} file(s) ===`);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${errors} errors out of ${results.length} total`);
  console.log(`Status: ${failed > 0 || errors > 0 ? "FAIL" : "PASS"}`);

  if (failed > 0 || errors > 0) {
    process.exit(1);
  }
}

const cmd = process.argv[2];
if (cmd === "generate") {
  generateGoldens();
} else if (cmd === "test") {
  runAllTests();
} else {
  console.log("Usage: npx tsx tools/validation/golden-runner.ts [generate|test]");
  console.log("  generate  — compute canonical outputs for all golden inputs");
  console.log("  test      — compare current calculator output against saved goldens");
}
