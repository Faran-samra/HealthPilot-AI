import { describe, expect, it } from 'vitest'
import {
  enrichAffirmativeReplies,
  expandSymptomQueryForRag,
  needsYellowFeverSymptomFollowUp,
  parseSymptomQueryContext,
  textForInfectionSignals,
  userRequestsImmediateGuidance,
  userWantsNearbyDoctorForSeizures,
} from './symptom-query.ts'

describe('parseSymptomQueryContext', () => {
  it('detects jaundice when user says yellow fever but denies fever', () => {
    const ctx = parseSymptomQueryContext(
      ['i have yellow fever', 'yellow skin for three days', 'no'],
      ['Are you experiencing a fever along with the yellowing of your eyes or skin?']
    )
    expect(ctx.meansJaundiceNotYellowFever).toBe(true)
    expect(ctx.hasJaundiceSigns).toBe(true)
    expect(ctx.hasFever).toBe(false)
  })

  it('does not treat yellow fever phrase as body fever', () => {
    expect(textForInfectionSignals('I have yellow fever disease')).not.toMatch(/\bfever\b/i)
  })

  it('detects claimed disease and denied travel', () => {
    const ctx = parseSymptomQueryContext(
      ['I have a yellow fever', 'i have yellow fever disease', 'no'],
      [
        'do you mean the disease Yellow Fever, or jaundice?',
        'Have you recently traveled to Africa or South America?',
      ]
    )
    expect(ctx.claimsYellowFeverDisease).toBe(true)
    expect(ctx.deniedYellowFeverTravel).toBe(true)
    expect(ctx.hasJaundiceSigns).toBe(false)
    expect(needsYellowFeverSymptomFollowUp(ctx)).toBe(true)
  })

  it('expands RAG query for jaundice not arboviral disease', () => {
    const ctx = parseSymptomQueryContext(['yellow eyes for 3 days', 'no fever'], [])
    const q = expandSymptomQueryForRag(ctx)
    expect(q).toMatch(/jaundice/i)
    expect(q).toMatch(/liver/i)
    expect(q).not.toMatch(/arbovirus/)
  })

  it('does not expand jaundice RAG when user only claims disease with no travel', () => {
    const ctx = parseSymptomQueryContext(
      ['yellow fever disease', 'no'],
      ['traveled to Africa or South America?']
    )
    const q = expandSymptomQueryForRag(ctx)
    expect(q).toMatch(/unlikely/i)
    expect(q).not.toMatch(/icterus yellow discoloration/)
  })
})

describe('enrichAffirmativeReplies', () => {
  it('expands han to include the last assistant question', () => {
    const userLines = ['mujhe acromegaly hai', 'haath barh rahe hain', 'han']
    const assistantLines = [
      'takleef?',
      'Kya jooton ka size barh gaya ya nazar mein tabdeeli?',
    ]
    const enriched = enrichAffirmativeReplies(userLines, assistantLines)
    expect(enriched[2]).toMatch(/yes/i)
    expect(enriched[2]).toMatch(/jooton|nazar/i)
  })
})

describe('doctor request finalize', () => {
  it('detects nearby doctor request with docor typo', () => {
    const lines = [
      'mujhe epilepsy hai to muje koi sahi sa docor suggest kr jo mere area k qareeb ho',
    ]
    expect(userWantsNearbyDoctorForSeizures(lines)).toBe(true)
    expect(userRequestsImmediateGuidance(lines)).toBe(true)
  })

  it('detects frustrated user wanting only a doctor', () => {
    const lines = [
      'mujhe epilepsy hai docor qareeb',
      'ye app muje se kya poch rhe ho muje kuch samaj nhi aa rhi muje bus koi acha sa doctor suggest krein',
    ]
    expect(userRequestsImmediateGuidance(lines)).toBe(true)
  })
})
