import { describe, expect, it } from 'vitest'
import {
  dedupeRagSources,
  formatRagCitationSubtitle,
  formatRagCitationTitle,
} from './ragCitationDisplay'

describe('ragCitationDisplay', () => {
  it('formats title without duplicate section suffix', () => {
    const title = formatRagCitationTitle({
      title: 'Allergic rhinitis — Emergency advice (Pakistan)',
      source: 'NHS UK',
      section: 'Emergency advice (Pakistan)',
      similarity: 0.82,
    })
    expect(title).toBe('Allergic rhinitis')
  })

  it('formats subtitle with readable labels', () => {
    const subtitle = formatRagCitationSubtitle({
      title: 'Allergic rhinitis',
      source: 'NHS UK',
      section: 'Pakistan health context',
      similarity: 0.8,
    })
    expect(subtitle).toMatch(/Pakistan health context/i)
    expect(subtitle).toMatch(/NHS reference/)
    expect(subtitle).not.toMatch(/localized_pakistan/)
  })

  it('dedupes near-identical sources', () => {
    const out = dedupeRagSources([
      {
        title: 'Allergic rhinitis — Symptoms',
        source: 'NHS UK',
        section: 'Symptoms',
        similarity: 0.9,
      },
      {
        title: 'Allergic rhinitis — Symptoms',
        source: 'NHS UK',
        section: 'Symptoms',
        similarity: 0.88,
      },
    ])
    expect(out).toHaveLength(1)
  })
})
