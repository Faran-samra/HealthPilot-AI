import { describe, expect, it } from 'vitest'
import { cleanMarhamListItems } from './marhamProfileText'

describe('cleanMarhamListItems', () => {
  it('splits embedded newlines', () => {
    expect(cleanMarhamListItems(['\\n\\n Cesarean Section\\n Vaginoplasty\\n Laparoscopy'])).toEqual([
      'Cesarean Section',
      'Vaginoplasty',
      'Laparoscopy',
    ])
  })
})
