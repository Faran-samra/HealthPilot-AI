import { describe, expect, it } from 'vitest'
import {
  classifySymptomRoute,
  escalateTier,
  getModelChain,
  getGeminiFlashModel,
  OPENAI_GPT4O_MINI,
  GROQ_LLAMA3,
  CLAUDE_SONNET,
} from './model-router.ts'

describe('classifySymptomRoute (multi-provider)', () => {
  it('uses economy chain with Gemini first for simple first follow-up', () => {
    const d = classifySymptomRoute({
      userText: 'mild headache',
      phase: 'follow_up',
      turnCount: 0,
      userMessageCount: 1,
    })
    expect(d.tier).toBe('economy')
    expect(d.modelChain[0].provider).toBe('gemini')
    expect(d.modelChain[0].model).toBe(getGeminiFlashModel())
    expect(d.modelChain.map((t) => t.model)).toContain(OPENAI_GPT4O_MINI)
    expect(d.modelChain.map((t) => t.model)).toContain(GROQ_LLAMA3)
  })

  it('uses premium tier for emergency keywords (Gemini first, Claude last if enabled)', () => {
    const d = classifySymptomRoute({
      userText: 'crushing chest pain and shortness of breath',
      phase: 'analysis',
      turnCount: 2,
      userMessageCount: 3,
    })
    expect(d.tier).toBe('premium')
    expect(d.modelChain[0].provider).toBe('gemini')
    expect(d.modelChain.length).toBeGreaterThan(0)
    expect(d.useRag).toBe(true)
  })

  it('standard analysis defaults to Gemini then Groq then OpenAI', () => {
    const chain = getModelChain('standard', 'analysis')
    expect(chain[0].provider).toBe('gemini')
    expect(chain[1]).toEqual({ provider: 'groq', model: GROQ_LLAMA3 })
    expect(chain[2]).toEqual({ provider: 'openai', model: OPENAI_GPT4O_MINI })
  })

  it('escalates tier economy → standard only (no auto-premium)', () => {
    expect(escalateTier('economy')).toBe('standard')
    expect(escalateTier('standard')).toBeNull()
    expect(escalateTier('premium')).toBeNull()
  })

  it('premium when client triage reports emergency', () => {
    const d = classifySymptomRoute({
      userText: 'feeling unwell',
      phase: 'follow_up',
      turnCount: 1,
      userMessageCount: 2,
      clientTriage: { severity: 'emergency', isEmergency: true },
    })
    expect(d.tier).toBe('premium')
    expect(d.modelChain[0].provider).toBe('gemini')
  })
})
