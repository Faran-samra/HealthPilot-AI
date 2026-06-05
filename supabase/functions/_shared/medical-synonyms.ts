/**
 * Urdu / Roman Urdu / English symptom phrases → NHS-oriented search terms and condition slugs.
 * Used for RAG query expansion only (not diagnosis).
 */

export interface MedicalSynonymExpansion {
  /** Extra English clinical text appended to the embed query */
  anchorText: string
  /** NHS condition_slug values to boost in retrieval ranking */
  conditionSlugs: string[]
  /** Terms for overlap filtering / ranking */
  searchTerms: string[]
  /** Chunk slug fragments to down-rank (e.g. newborn-only topics) */
  excludeSlugFragments: string[]
}

export interface SymptomRule {
  patterns: RegExp[]
  conditionSlugs: string[]
  englishTerms: string[]
  /** Short English line for embedding / display normalization */
  englishSummary: string
  excludeSlugFragments?: string[]
}

const RULES: SymptomRule[] = [
  {
    patterns: [
      /peeli?\s+aankh|peeli?\s+ankh|peeli?\s+ankein|yellow\s+eyes?/i,
      /zard\s+(aankh|ankh|ankein)|زرد\s*آنکھ|آنکھ.*زرد|زرد.*آنکھ/i,
      /jaundice|icterus|یرقان|yarqan/i,
      /yellow(ing)?\s+(skin|eyes)|zard\s+jild|پیل[ai]\s+جلد/i,
      /dark\s+urine|gahra\s+peshab|گہرا\s*پیشاب|pila\s+pee|clay.?colou?red\s+stool/i,
    ],
    conditionSlugs: ['jaundice', 'hepatitis', 'liver-disease', 'gallstones'],
    englishTerms: [
      'jaundice',
      'yellow eyes',
      'yellow skin',
      'dark urine',
      'bilirubin',
      'liver',
      'hepatitis',
      'gallstones',
      'LFT',
    ],
    englishSummary: 'yellow eyes or skin (jaundice), dark urine, liver or gallbladder disease',
    excludeSlugFragments: ['jaundice-in-babies', 'newborn'],
  },
  {
    patterns: [
      /\bbukhar\b|\bbukhaar\b|\bbukhhar\b|بخار|high\s+temperature|bukhar\s+hai/i,
      /\bfever\b/i,
    ],
    conditionSlugs: ['typhoid', 'malaria', 'dengue', 'flu', 'chest-infection', 'pneumonia'],
    englishTerms: [
      'fever',
      'high temperature',
      'prolonged fever',
      'chills',
      'body aches',
      'typhoid',
      'malaria',
      'dengue',
      'viral infection',
    ],
    englishSummary:
      'fever with weakness, chills, or body aches — possible typhoid, malaria, dengue, or viral illness in Pakistan',
  },
  {
    patterns: [
      /sneez|sneezing|runny nose|blocked nose|stuffy nose|watery eyes|hay fever|allergic rhinitis/i,
      /nasal congestion|itchy (eyes|nose)|worse outdoors|dusty|windy|pollen/i,
    ],
    conditionSlugs: ['hay-fever', 'allergic-rhinitis', 'allergies', 'non-allergic-rhinitis'],
    englishTerms: [
      'allergic rhinitis',
      'hay fever',
      'sneezing',
      'watery eyes',
      'blocked nose',
      'nasal congestion',
      'dust allergy',
      'pollen',
    ],
    englishSummary:
      'sneezing, watery eyes, blocked nose worse outdoors or with dust — possible allergic rhinitis or hay fever',
  },
  {
    patterns: [
      /heart\s+beat(ing)?\s*(fast|quick|racing)|racing\s+heart|palpitation|tachycardia/i,
      /fast\s+heartbeat|dharkan\s+tez|dil\s+ki\s+dharkan/i,
    ],
    conditionSlugs: [
      'supraventricular-tachycardia-svt',
      'postural-tachycardia-syndrome',
      'cardiovascular-disease',
    ],
    englishTerms: [
      'palpitations',
      'tachycardia',
      'fast heartbeat',
      'racing heart',
      'anxiety palpitations',
      'ECG',
    ],
    englishSummary:
      'fast heartbeat or palpitations, especially with stress, caffeine, or anxiety — cardiac assessment',
  },
  {
    patterns: [/khansi|khasi|کھانسی|\bcough\b/i],
    conditionSlugs: ['chest-infection', 'flu', 'common-cold', 'pneumonia', 'bronchitis'],
    englishTerms: ['cough', 'chest infection', 'respiratory'],
    englishSummary: 'cough, chest or respiratory infection',
  },
  {
    patterns: [/pet\s+dard|pet\s+mein|پیٹ\s*درد|stomach\s+pain|abdominal\s+pain|tummy\s+pain/i],
    conditionSlugs: ['gastritis', 'appendicitis', 'gallstones', 'hepatitis', 'food-poisoning'],
    englishTerms: ['abdominal pain', 'stomach pain', 'nausea', 'vomiting'],
    englishSummary: 'abdominal or stomach pain',
  },
  {
    patterns: [/sar\s+dard|سر\s*درد|\bheadache\b|migraine/i],
    conditionSlugs: ['migraine', 'headache', 'meningitis'],
    englishTerms: ['headache', 'migraine'],
    englishSummary: 'headache or migraine',
  },
  {
    patterns: [
      /\bdehydrat/i,
      /pani\s+ki\s+kami|piyas|pyaas|پیاس|پانی\s*کی\s*کمی/i,
      /\bORS\b|oral\s+rehydration|rehydration\s+(solution|powder|salt)/i,
      /fluid\s+loss|not\s+drinking\s+enough|kam\s+paani|کم\s*پانی/i,
    ],
    conditionSlugs: [
      'dehydration',
      'gastroenteritis',
      'food-poisoning',
      'norovirus',
      'heat-exhaustion-heatstroke',
    ],
    englishTerms: [
      'dehydration',
      'thirst',
      'dry mouth',
      'dark urine',
      'peeing less',
      'ORS',
      'oral rehydration',
      'fluid loss',
      'vomiting',
      'diarrhoea',
      'diarrhea',
    ],
    excludeSlugFragments: [
      'diabetes-insipidus',
      'brain-abscess',
      'kidney-stones',
      'erythrocytosis',
      'brugada-syndrome',
      'retinal-migraine',
      'acute-kidney-injury',
    ],
    englishSummary: 'dehydration, thirst, fluid loss, vomiting or diarrhoea, need for oral rehydration',
  },
  {
    patterns: [/kamzori|کمزوری|\bweakness\b|\bfatigue\b|thak(an|awat)?/i],
    conditionSlugs: ['anaemia', 'diabetes-type-2', 'hypothyroidism'],
    englishTerms: ['weakness', 'fatigue', 'tiredness', 'anaemia'],
    englishSummary: 'weakness, fatigue, tiredness',
  },
  {
    patterns: [/sina|سینے|chest\s+pain|heart\s+pain/i],
    conditionSlugs: ['angina', 'heart-attack', 'chest-infection'],
    englishTerms: ['chest pain', 'heart'],
    englishSummary: 'chest pain, possible heart or lung problem',
  },
  {
    patterns: [/sans|سانس|breathless|shortness\s+of\s+breath|difficulty\s+breathing/i],
    conditionSlugs: ['asthma', 'copd', 'chest-infection', 'pneumonia'],
    englishTerms: ['breathing', 'shortness of breath', 'asthma'],
    englishSummary: 'shortness of breath or breathing difficulty',
  },
  {
    patterns: [/ulti|qay|vomit|vomiting|قے/i],
    conditionSlugs: ['gastroenteritis', 'food-poisoning', 'hepatitis'],
    englishTerms: ['vomiting', 'nausea', 'dehydration'],
    englishSummary: 'vomiting or nausea',
  },
  {
    patterns: [/skin\s+rash|khujli|خارش|\brush\b|itching/i],
    conditionSlugs: ['eczema', 'scabies', 'measles', 'chickenpox'],
    englishTerms: ['rash', 'itching', 'skin'],
    englishSummary: 'skin rash or itching',
  },
  {
    patterns: [/pee\s+pressure|burning\s+urination|urinary|پیشاب/i],
    conditionSlugs: ['urinary-tract-infections-utis', 'kidney-infection'],
    englishTerms: ['urinary tract infection', 'UTI', 'painful urination'],
    englishSummary: 'urinary symptoms or painful urination',
  },
  {
    patterns: [
      /epilepsy|seizure|convulsion|\bfits\b|doray|dora\b|janay|behosh|behoshi/i,
      /ankh.*band|eyes?\s+clos|loss of control|convuls/i,
    ],
    conditionSlugs: ['epilepsy', 'febrile-seizures'],
    englishTerms: ['epilepsy', 'seizure', 'convulsion', 'fits', 'loss of consciousness'],
    englishSummary: 'seizure, convulsion, epilepsy, loss of consciousness',
  },
  {
    patterns: [/dast|loose\s+motion|diarrh|پیچش/i],
    conditionSlugs: ['gastroenteritis', 'food-poisoning', 'norovirus'],
    englishTerms: ['diarrhoea', 'diarrhea', 'loose stools', 'gastroenteritis'],
    englishSummary: 'diarrhoea or loose motions',
  },
  {
    patterns: [/chakkar|چکر|dizzy|vertigo|spinning/i],
    conditionSlugs: ['labyrinthitis', 'vertigo', 'migraine'],
    englishTerms: ['dizziness', 'vertigo', 'balance problem'],
    englishSummary: 'dizziness or vertigo',
  },
  {
    patterns: [/zukam|nazla|نزلہ|زکام/i],
    conditionSlugs: ['common-cold', 'flu'],
    englishTerms: ['cold', 'runny nose', 'flu', 'upper respiratory infection'],
    englishSummary: 'common cold or flu-like illness',
  },
  {
    patterns: [
      /acromegaly/i,
      /haath.*barh|hath.*barh|hands?.*(larger|big|enlarged)/i,
      /face.*barh|chehra.*barh|facial.*(change|enlarg)/i,
      /growth hormone|pituitary|IGF/i,
    ],
    conditionSlugs: ['acromegaly'],
    englishTerms: [
      'acromegaly',
      'growth hormone excess',
      'enlarged hands',
      'enlarged face',
      'pituitary tumour',
      'headache',
      'IGF-1',
      'endocrinology',
    ],
    englishSummary: 'acromegaly, enlarged hands or face, growth hormone excess, pituitary disorder, headaches',
  },
]

/** Rules whose patterns match the given text (user message or conversation). */
export function matchMedicalSymptomRules(text: string): SymptomRule[] {
  const t = text.trim()
  if (!t) return []
  return RULES.filter((rule) => rule.patterns.some((p) => p.test(t)))
}

/** When jaundice is inferred, down-rank arboviral yellow fever NHS page unless travel context. */
const YELLOW_FEVER_VIRUS_SLUG = 'yellow-fever'

export function expandMedicalSynonyms(text: string): MedicalSynonymExpansion {
  const t = text.trim()
  if (!t) {
    return { anchorText: '', conditionSlugs: [], searchTerms: [], excludeSlugFragments: [] }
  }

  const slugSet = new Set<string>()
  const termSet = new Set<string>()
  const excludeSet = new Set<string>()
  const matchedRules = matchMedicalSymptomRules(t)

  for (const rule of matchedRules) {
    rule.conditionSlugs.forEach((s) => slugSet.add(s))
    rule.englishTerms.forEach((term) => termSet.add(term.toLowerCase()))
    rule.excludeSlugFragments?.forEach((ex) => excludeSet.add(ex))
  }

  const jaundiceLike =
    slugSet.has('jaundice') ||
    /peeli|zard|یرقان|jaundice|yellow\s+(eye|skin)|dark\s+urine/i.test(t)
  const travelEndemic = /africa|south\s+america|travel|mosquito/i.test(t)

  if (jaundiceLike && !travelEndemic) {
    excludeSet.add(YELLOW_FEVER_VIRUS_SLUG)
  }

  if (/\b(baby|infant|newborn|بچہ|نوزائیدہ)\b/i.test(t)) {
    excludeSet.delete('jaundice-in-babies')
    excludeSet.delete('newborn')
  } else {
    excludeSet.add('jaundice-in-babies')
    excludeSet.add('newborn-jaundice')
  }

  const anchorText =
    termSet.size > 0
      ? `[Clinical search terms: ${[...termSet].slice(0, 24).join(', ')}]`
      : ''

  return {
    anchorText,
    conditionSlugs: [...slugSet],
    searchTerms: [...termSet],
    excludeSlugFragments: [...excludeSet],
  }
}
