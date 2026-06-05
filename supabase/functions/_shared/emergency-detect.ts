/** Server-side emergency detection — finalize immediately, skip slow RAG. */

const EMERGENCY_PATTERNS: RegExp[] = [
  /chest pain|heart attack|crushing chest/i,
  /can't breathe|cannot breathe|difficulty breathing|shortness of breath|gasping|trouble breathing/i,
  /stroke|face droop|slurred speech|one side weak/i,
  /unconscious|passed out|fainted|not responding/i,
  /severe bleeding|heavy bleeding|blood vomiting/i,
  /suicid|self harm|kill myself/i,
  /seizure|convulsion|\bfits\b/i,
  /anaphyla/i,
  /allergic reaction|severe allergy/i,
  /swelling.*(lip|face|throat|tongue)|lip.*swell|face.*swell|throat.*tight/i,
  /(peanut|nuts?|shellfish|egg|food).*(swell|breath|itch|hives|rash)/i,
  /(swell|breath|itch).*(peanut|nuts?|food)/i,
]

export function matchesEmergencySymptoms(text: string): boolean {
  return EMERGENCY_PATTERNS.some((p) => p.test(text))
}

export function isAnaphylaxisContext(text: string): boolean {
  const t = text.toLowerCase()
  const allergen = /peanut|nuts?|shellfish|egg|food|medicine|drug|sting|bee/i.test(t)
  const swelling = /swell|puff|lip|face|throat|tongue/i.test(t)
  const breathing = /breath|breathing|gasp|choke|suffocat/i.test(t)
  const rapid = /within minutes|sudden|immediately|foran|minute/i.test(t)
  const itch = /itch|hive|rash|khujli/i.test(t)
  return (
    /anaphyla/i.test(t) ||
    (allergen && swelling && (breathing || itch)) ||
    (swelling && breathing && rapid) ||
    (swelling && breathing && allergen)
  )
}
