import { describe, expect, it } from 'vitest'
import { expandMedicalSynonyms } from './medical-synonyms.ts'

describe('expandMedicalSynonyms', () => {
  it('maps Roman Urdu peeli aankhen to jaundice slugs', () => {
    const r = expandMedicalSynonyms('Mujhe peeli aankhen hain aur peshab gehra hai')
    expect(r.conditionSlugs).toContain('jaundice')
    expect(r.searchTerms).toContain('jaundice')
    expect(r.searchTerms).toContain('yellow eyes')
    expect(r.excludeSlugFragments).toContain('yellow-fever')
  })

  it('maps bukhar to fever-related slugs', () => {
    const r = expandMedicalSynonyms('Mujhe bukhar hai')
    expect(r.conditionSlugs.some((s) => /flu|chest-infection|cold|pneumonia/.test(s))).toBe(true)
    expect(r.searchTerms).toContain('fever')
  })

  it('maps Urdu script jaundice terms', () => {
    const r = expandMedicalSynonyms('میری آنکھیں زرد ہیں')
    expect(r.conditionSlugs).toContain('jaundice')
  })

  it('maps dehydration complaints to dehydration NHS slug', () => {
    const r = expandMedicalSynonyms('muje Dehydration hai\n4 dino se')
    expect(r.conditionSlugs).toContain('dehydration')
    expect(r.searchTerms).toContain('dehydration')
    expect(r.excludeSlugFragments).toContain('diabetes-insipidus')
  })
})
