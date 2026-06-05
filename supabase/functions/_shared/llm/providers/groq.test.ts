import { describe, expect, it } from 'vitest'
import {
  isGroqRateLimitError,
  parseAskFollowUpFromFailedGeneration,
  parseAskFollowUpFromGroqError,
} from './groq.ts'

describe('isGroqRateLimitError', () => {
  it('detects TPM rate limit payloads', () => {
    const msg =
      'Groq JSON fallback 429: {"error":{"message":"Rate limit reached for model `llama-3.1-8b-instant`","type":"tokens","code":"rate_limit_exceeded"}}'
    expect(isGroqRateLimitError(msg)).toBe(true)
  })
})

describe('parseAskFollowUpFromGroqError', () => {
  it('parses failed_generation pseudo-XML from Groq 400', () => {
    const err =
      'Groq/Llama 400: {"error":{"message":"tool_use_failed","failed_generation":"\\u003cfunction=ask_follow_up\\u003emessage=Kuchh din se kaisi takleef hai, quick_severity=mild\\u003c/function\\u003e"}}'
    const out = parseAskFollowUpFromGroqError(err)
    expect(out?.message).toMatch(/takleef/i)
    expect(out?.quick_severity).toBe('mild')
  })

  it('parses unescaped failed_generation', () => {
    const out = parseAskFollowUpFromFailedGeneration(
      '<function=ask_follow_up>message=Headache kitne din se hai?, quick_severity=moderate</function>'
    )
    expect(out?.quick_severity).toBe('moderate')
    expect(out?.message).toMatch(/Headache/)
  })
})
