/**
 * HealthPilot LLM eval harness — calls analyze-symptoms edge function.
 *
 * Usage:
 *   export VITE_SUPABASE_URL=https://xxx.supabase.co
 *   export VITE_SUPABASE_ANON_KEY=eyJ...
 *   deno run -A eval/run-eval.ts
 *   deno run -A eval/run-eval.ts --sample 5
 *   deno run -A eval/run-eval.ts --write-report
 */

import type { EvalCase, EvalRunResult, EvalSummary } from './schema.ts'

const SEVERITY_ORDER = ['mild', 'moderate', 'severe', 'emergency'] as const

function severityRank(s: string): number {
  const i = SEVERITY_ORDER.indexOf(s as (typeof SEVERITY_ORDER)[number])
  return i >= 0 ? i : 0
}

function loadEnv(key: string): string | undefined {
  return Deno.env.get(key) ?? Deno.env.get(key.replace('VITE_', ''))
}

function parseArgs() {
  const args = Deno.args
  let sample: number | null = null
  let writeReport = false
  let langFilter: string | null = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sample' && args[i + 1]) sample = parseInt(args[i + 1], 10)
    if (args[i] === '--write-report') writeReport = true
    if (args[i] === '--lang' && args[i + 1]) langFilter = args[i + 1]
  }
  return { sample, writeReport, langFilter }
}

async function loadCases(fileUrl: URL): Promise<EvalCase[]> {
  const text = await Deno.readTextFile(fileUrl)
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EvalCase)
}

async function invokeAnalyze(
  baseUrl: string,
  anonKey: string,
  testCase: EvalCase
): Promise<{ body: Record<string, unknown>; latencyMs: number; ok: boolean; error?: string }> {
  const started = Date.now()
  const language = testCase.language === 'ur' ? 'ur' : 'en'
  const res = await fetch(`${baseUrl}/functions/v1/analyze-symptoms`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      symptoms: testCase.symptoms,
      language,
      userAge: testCase.user_age,
      userGender: testCase.user_gender,
    }),
  })
  const latencyMs = Date.now() - started
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return {
      ok: false,
      body,
      latencyMs,
      error: typeof body.error === 'string' ? body.error : res.statusText,
    }
  }
  return { ok: true, body, latencyMs }
}

function scoreCase(testCase: EvalCase, body: Record<string, unknown>, latencyMs: number): EvalRunResult {
  const exp = testCase.expected
  const actualSeverity = String(body.severity_level ?? '')
  const actualSpecialty = String(body.recommended_specialty_slug ?? '')
  const redFlags = Array.isArray(body.red_flags) ? body.red_flags as string[] : []

  const schemaValid =
    Boolean(body.severity_level) &&
    Boolean(body.recommended_specialty_slug) &&
    Boolean(body.disclaimer) &&
    Array.isArray(body.red_flags)

  const severityMatch =
    actualSeverity === exp.severity_level ||
    (exp.min_severity != null && severityRank(actualSeverity) >= severityRank(exp.min_severity))

  const acceptable = exp.specialty_slugs_acceptable ?? [exp.recommended_specialty_slug]
  const specialtyMatch = acceptable.includes(actualSpecialty)

  const redFlagOk = !exp.must_include_red_flag || redFlags.length > 0

  const passed = schemaValid && severityMatch && specialtyMatch && redFlagOk

  return {
    caseId: testCase.id,
    passed,
    severityMatch,
    specialtyMatch,
    redFlagOk,
    schemaValid,
    latencyMs,
    actualSeverity,
    actualSpecialty,
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function summarize(results: EvalRunResult[], cases: EvalCase[]): EvalSummary {
  const emergencyCases = cases.filter((c) => c.expected.severity_level === 'emergency')
  const emergencyIds = new Set(emergencyCases.map((c) => c.id))
  const emergencyResults = results.filter((r) => emergencyIds.has(r.caseId))
  const emergencyTp = emergencyResults.filter((r) => r.severityMatch && r.schemaValid).length

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b)

  const byLanguage: EvalSummary['byLanguage'] = {}
  for (const c of cases) {
    const lang = c.language
    if (!byLanguage[lang]) byLanguage[lang] = { total: 0, specialtyAccuracy: 0, severityAccuracy: 0 }
    byLanguage[lang].total++
  }
  for (const r of results) {
    const c = cases.find((x) => x.id === r.caseId)
    if (!c) continue
    const bucket = byLanguage[c.language]
    if (r.specialtyMatch) bucket.specialtyAccuracy++
    if (r.severityMatch) bucket.severityAccuracy++
  }
  for (const lang of Object.keys(byLanguage)) {
    const b = byLanguage[lang]
    b.specialtyAccuracy = b.total ? Math.round((b.specialtyAccuracy / b.total) * 100) : 0
    b.severityAccuracy = b.total ? Math.round((b.severityAccuracy / b.total) * 100) : 0
  }

  const n = results.length || 1
  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    specialtyAccuracy: Math.round((results.filter((r) => r.specialtyMatch).length / n) * 100),
    severityAccuracy: Math.round((results.filter((r) => r.severityMatch).length / n) * 100),
    emergencyRecall: emergencyResults.length
      ? Math.round((emergencyTp / emergencyResults.length) * 100)
      : 100,
    emergencyTotal: emergencyResults.length,
    schemaValidRate: Math.round((results.filter((r) => r.schemaValid).length / n) * 100),
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    byLanguage,
  }
}

function formatReport(summary: EvalSummary, failures: EvalRunResult[]): string {
  const date = new Date().toISOString().slice(0, 19)
  let md = `# LLM evaluation results\n\n> Auto-generated by \`eval/run-eval.ts\`. Last run: ${date} UTC\n\n`
  md += `## Summary\n\n| Metric | Value |\n|--------|-------|\n`
  md += `| Cases run | ${summary.total} |\n`
  md += `| Passed (all checks) | ${summary.passed} |\n`
  md += `| Specialty exact match | ${summary.specialtyAccuracy}% |\n`
  md += `| Severity match | ${summary.severityAccuracy}% |\n`
  md += `| Emergency recall | ${summary.emergencyRecall}% (${summary.emergencyTotal} cases) |\n`
  md += `| Schema valid | ${summary.schemaValidRate}% |\n`
  md += `| Latency p50 (ms) | ${summary.latencyP50} |\n`
  md += `| Latency p95 (ms) | ${summary.latencyP95} |\n\n`
  md += `## By language\n\n| Language | Cases | Specialty acc. | Severity acc. |\n|----------|-------|----------------|---------------|\n`
  for (const [lang, row] of Object.entries(summary.byLanguage)) {
    md += `| ${lang} | ${row.total} | ${row.specialtyAccuracy}% | ${row.severityAccuracy}% |\n`
  }
  if (failures.length > 0) {
    md += `\n## Failures (${failures.length})\n\n`
    for (const f of failures.slice(0, 15)) {
      md += `- **${f.caseId}**: severity=${f.actualSeverity} specialty=${f.actualSpecialty}${f.error ? ` err=${f.error}` : ''}\n`
    }
  }
  return md
}

async function main() {
  const { sample, writeReport, langFilter } = parseArgs()
  const baseUrl = loadEnv('VITE_SUPABASE_URL')
  const anonKey = loadEnv('VITE_SUPABASE_ANON_KEY')

  if (!baseUrl || !anonKey) {
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_*)')
    Deno.exit(1)
  }

  let cases = await loadCases(new URL('./cases.jsonl', import.meta.url))
  if (langFilter) cases = cases.filter((c) => c.language === langFilter)
  if (sample != null && sample > 0) cases = cases.slice(0, sample)

  console.log(`Running ${cases.length} eval cases against analyze-symptoms...\n`)

  const results: EvalRunResult[] = []

  for (const testCase of cases) {
    process.stdout.write(`  ${testCase.id}... `)
    const { ok, body, latencyMs, error } = await invokeAnalyze(baseUrl, anonKey, testCase)
    if (!ok) {
      results.push({
        caseId: testCase.id,
        passed: false,
        severityMatch: false,
        specialtyMatch: false,
        redFlagOk: false,
        schemaValid: false,
        latencyMs,
        error,
      })
      console.log(`FAIL (${error})`)
      continue
    }
    const scored = scoreCase(testCase, body, latencyMs)
    results.push(scored)
    console.log(scored.passed ? 'OK' : `FAIL (sev=${scored.actualSeverity} spec=${scored.actualSpecialty})`)
    await new Promise((r) => setTimeout(r, 800))
  }

  const summary = summarize(results, cases)
  const failures = results.filter((r) => !r.passed)

  console.log('\n--- Summary ---')
  console.log(JSON.stringify(summary, null, 2))

  if (writeReport) {
    const reportUrl = new URL('../docs/eval-results.md', import.meta.url)
    await Deno.writeTextFile(reportUrl, formatReport(summary, failures))
    console.log(`\nWrote ${reportUrl.pathname}`)
  }

  Deno.exit(summary.passed === summary.total ? 0 : 1)
}

main()
