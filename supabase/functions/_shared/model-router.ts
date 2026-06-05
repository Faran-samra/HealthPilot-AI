/**
 * Symptom LLM router — selects provider + model by complexity and risk.
 * Default: GPT-4o-mini | Simple: Gemini (AI Studio) | Fallback: Llama 3 (Groq) | High-risk: Claude
 */

import type { ModelTarget } from './llm/types.ts'
import {
  anthropicEnabled,
  envGet,
  forcedProviderFromEnv,
  geminiModelId,
  providerHasKey,
} from './llm/env.ts'

export const OPENAI_GPT4O_MINI = 'gpt-4o-mini'
/** Resolved at runtime — set GEMINI_MODEL if Google returns 404 for default. */
export function getGeminiFlashModel(): string {
  return geminiModelId()
}
export const GROQ_LLAMA3 = 'llama-3.1-8b-instant'
export const CLAUDE_SONNET = 'claude-sonnet-4-6'
export const CLAUDE_SONNET_FALLBACK = 'claude-sonnet-4-5-20250929'

export type RouteTier = 'economy' | 'standard' | 'premium'
export type RoutePhase = 'follow_up' | 'analysis'

export interface ClientTriageHint {
  severity?: 'mild' | 'moderate' | 'severe' | 'emergency' | null
  isEmergency?: boolean
  matchedKeywords?: string[]
}

export interface RouteInput {
  userText: string
  phase: RoutePhase
  turnCount: number
  userMessageCount: number
  forceFinalize?: boolean
  clientTriage?: ClientTriageHint | null
  lastQuickSeverity?: 'mild' | 'moderate' | 'severe' | 'emergency' | null
}

export interface RouteDecision {
  tier: RouteTier
  phase: RoutePhase
  reasons: string[]
  modelChain: readonly ModelTarget[]
  maxTokens: number
  useRag: boolean
}

const EMERGENCY_PATTERNS: RegExp[] = [
  /chest pain|heart attack|crushing chest/i,
  /can't breathe|cannot breathe|difficulty breathing|shortness of breath|gasping/i,
  /stroke|face droop|slurred speech|one side weak/i,
  /unconscious|passed out|fainted|not responding/i,
  /severe bleeding|heavy bleeding|blood vomiting/i,
  /suicid|self harm|kill myself/i,
  /seizure|convulsion|fits/i,
  /سینے میں درد|سانس نہیں|بے ہوش/i,
]

const SEVERE_PATTERNS: RegExp[] = [
  /high fever|104|105|very high fever|40\.?5|41\.?0/i,
  /severe pain|intolerable pain|worst pain/i,
  /blood in stool|blood in urine|bloody/i,
  /sudden severe headache|thunderclap/i,
  /شدید درد|تیز بخار/i,
]

const SENSITIVE_PATTERNS: RegExp[] = [
  /pregnan|trimester|miscarriage|حاملہ|حمل/i,
  /\b(baby|infant|newborn|neonat|under\s*5|month old)\b/i,
  /بچہ|نوزائیدہ/i,
]

const AMBIGUOUS_PATTERNS: RegExp[] = [
  /not sure|don't know|unclear|multiple symptoms|various symptoms/i,
  /کچھ عرصے سے|سمجھ نہیں/i,
]

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

function forcedTierFromEnv(): RouteTier | null {
  const raw = envGet('SYMPTOM_ROUTER_FORCE_TIER')?.toLowerCase()
  if (raw === 'economy' || raw === 'standard' || raw === 'premium') return raw
  return null
}

const llamaFallback = (): ModelTarget => ({ provider: 'groq', model: GROQ_LLAMA3 })
const gptDefault = (): ModelTarget => ({ provider: 'openai', model: OPENAI_GPT4O_MINI })
const geminiSimple = (): ModelTarget => ({ provider: 'gemini', model: getGeminiFlashModel() })
const claudePrimary = (): ModelTarget => ({ provider: 'anthropic', model: CLAUDE_SONNET })
const claudeBackup = (): ModelTarget => ({ provider: 'anthropic', model: CLAUDE_SONNET_FALLBACK })

/**
 * Cost-optimized order: Gemini (AI Studio free tier) → Groq Llama → OpenAI mini.
 * Claude only on premium tier when ANTHROPIC_DISABLED is not set.
 */
export function getModelChain(tier: RouteTier, phase: RoutePhase): readonly ModelTarget[] {
  const cheapFollowUp = [geminiSimple(), llamaFallback(), gptDefault()]
  const cheapAnalysis = [geminiSimple(), llamaFallback(), gptDefault()]

  if (phase === 'follow_up') {
    if (tier === 'premium' && anthropicEnabled()) {
      return [geminiSimple(), llamaFallback(), gptDefault(), claudePrimary(), claudeBackup()]
    }
    return cheapFollowUp
  }

  if (tier === 'premium' && anthropicEnabled()) {
    return [geminiSimple(), llamaFallback(), gptDefault(), claudePrimary(), claudeBackup()]
  }
  return cheapAnalysis
}

/** Retry after validation issues or low confidence — still cheap-first. */
export function getQualityEscalationChain(phase: RoutePhase): readonly ModelTarget[] {
  const base: ModelTarget[] = [geminiSimple(), gptDefault(), llamaFallback()]
  if (phase === 'analysis' && anthropicEnabled()) {
    return [...base, claudePrimary()]
  }
  return base
}

/** @deprecated Use getQualityEscalationChain */
export function getClaudeEscalationChain(phase: RoutePhase): readonly ModelTarget[] {
  return getQualityEscalationChain(phase)
}

export function getMaxTokens(tier: RouteTier, phase: RoutePhase): number {
  if (phase === 'follow_up') {
    if (tier === 'premium') return 384
    if (tier === 'economy') return 256
    return 320
  }
  return tier === 'premium' ? 1536 : 1024
}

export function shouldUseRag(tier: RouteTier, phase: RoutePhase, _userText: string): boolean {
  // RAG is final-analysis only — never during follow-up / triage question turns.
  return phase === 'analysis'
}

/** API failure: economy→standard only. Do not auto-jump to premium/Claude. */
export function escalateTier(tier: RouteTier): RouteTier | null {
  if (tier === 'economy') return 'standard'
  return null
}

export function formatRoutingNote(
  decision: RouteDecision,
  extra?: { modelUsed?: string; attempts?: string[] }
): string {
  const chain = decision.modelChain.map((t) => `${t.provider}:${t.model}`).join('>')
  const parts = [
    `route:${decision.tier}`,
    `phase:${decision.phase}`,
    `chain:${chain}`,
    `reasons:${decision.reasons.join(',')}`,
  ]
  if (extra?.modelUsed) parts.push(`used:${extra.modelUsed}`)
  if (extra?.attempts?.length) parts.push(`attempts:${extra.attempts.join('|')}`)
  return parts.join(';')
}

export function classifySymptomRoute(input: RouteInput): RouteDecision {
  const reasons: string[] = []
  const { userText, phase, turnCount, userMessageCount, clientTriage, lastQuickSeverity } = input

  const envTier = forcedTierFromEnv()
  if (envTier) {
    return buildDecision(envTier, phase, userText, [`env_force_${envTier}`])
  }

  if (clientTriage?.isEmergency || clientTriage?.severity === 'emergency') {
    reasons.push('client_emergency')
  }
  if (clientTriage?.severity === 'severe') reasons.push('client_severe')
  if (lastQuickSeverity === 'emergency') reasons.push('prior_quick_emergency')
  if (lastQuickSeverity === 'severe') reasons.push('prior_quick_severe')

  if (matchAny(userText, EMERGENCY_PATTERNS)) reasons.push('emergency_keywords')
  if (matchAny(userText, SEVERE_PATTERNS)) reasons.push('severe_keywords')
  if (matchAny(userText, SENSITIVE_PATTERNS)) reasons.push('sensitive_cohort')
  if (matchAny(userText, AMBIGUOUS_PATTERNS)) reasons.push('ambiguous_case')

  // Premium (may include Claude last) only for true high-risk — not vague/ambiguous cases.
  const premiumReasons = reasons.filter((r) =>
    r.includes('emergency') ||
    r.includes('severe') ||
    r === 'sensitive_cohort'
  )

  let tier: RouteTier
  if (premiumReasons.length > 0) {
    tier = 'premium'
  } else if (
    phase === 'follow_up' &&
    turnCount === 0 &&
    userMessageCount <= 1 &&
    userText.trim().length < 100 &&
    !matchAny(userText, SEVERE_PATTERNS)
  ) {
    tier = 'economy'
    reasons.push('simple_first_turn')
  } else {
    tier = 'standard'
    if (reasons.length === 0) reasons.push('default')
  }

  return buildDecision(tier, phase, userText, reasons)
}

function buildDecision(
  tier: RouteTier,
  phase: RoutePhase,
  userText: string,
  reasons: string[]
): RouteDecision {
  let chain = getModelChain(tier, phase)

  const forceProvider = forcedProviderFromEnv()
  if (forceProvider) {
    const forced = chain.find((t) => t.provider === forceProvider)
    if (forced) chain = [forced, ...chain.filter((t) => t !== forced)]
    reasons.push(`env_force_provider_${forceProvider}`)
  }

  return {
    tier,
    phase,
    reasons,
    modelChain: chain,
    maxTokens: getMaxTokens(tier, phase),
    useRag: shouldUseRag(tier, phase, userText),
  }
}

/** Drop providers without keys or disabled (e.g. ANTHROPIC_DISABLED). */
export function filterModelChain(chain: readonly ModelTarget[]): ModelTarget[] {
  const seen = new Set<string>()
  const out: ModelTarget[] = []
  for (const t of chain) {
    if (!providerHasKey(t.provider)) continue
    const key = `${t.provider}:${t.model}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export function isLowConfidenceAnalysis(input: Record<string, unknown>): boolean {
  return input.condition_confidence === 'low'
}
