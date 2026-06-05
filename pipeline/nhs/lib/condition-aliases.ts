/**
 * Lay terms, acronyms, and search aliases for embedding enrichment (symptom-style queries).
 */

const SLUG_ALIASES: Record<string, string[]> = {
  'abdominal-aortic-aneurysm': [
    'AAA',
    'abdominal aortic aneurysm',
    'aortic aneurysm',
    'bulging aorta',
    'tummy pain',
    'back pain',
    'pulsing abdomen',
    'ruptured aneurysm',
  ],
  dehydration: [
    'dehydration',
    'thirst',
    'dry mouth',
    'not drinking enough',
    'fluid loss',
    'ORS',
    'oral rehydration',
    'loose motions',
    'dast',
    'piyas',
    'pyaas',
  ],
  jaundice: ['jaundice', 'yellow eyes', 'yellow skin', 'peeli aankhen', 'zard rang', 'liver', 'bilirubin', 'یرقان'],
  hepatitis: ['hepatitis', 'liver inflammation', 'jaundice', 'LFT', 'جگر'],
  epilepsy: ['epilepsy', 'seizure', 'convulsion', 'fits', 'doray', 'behoshi', 'neurology'],
  'whooping-cough': ['whooping cough', 'pertussis', 'severe cough', 'whoop sound', 'khansi'],
  flu: ['flu', 'influenza', 'bukhar', 'fever', 'cough', 'body aches', 'zukam'],
  'common-cold': ['cold', 'runny nose', 'sore throat', 'nazla', 'zukam'],
  'urinary-tract-infections-utis': ['UTI', 'urinary infection', 'burning urination', 'bladder infection', 'پیشاب'],
  pneumonia: ['pneumonia', 'chest infection', 'breathing difficulty', 'bukhar', 'khansi'],
  asthma: ['asthma', 'wheezing', 'shortness of breath', 'sans', 'سانس'],
  diabetes: ['diabetes', 'high blood sugar', 'sugar', 'thirst', 'frequent urination'],
  'food-poisoning': ['food poisoning', 'vomiting', 'diarrhoea', 'stomach bug', 'ulti', 'dast'],
  gastroenteritis: ['gastroenteritis', 'stomach flu', 'vomiting', 'diarrhoea', 'dehydration'],
  migraine: ['migraine', 'severe headache', 'sar dard', 'سر درد'],
  meningitis: ['meningitis', 'stiff neck', 'rash', 'severe headache', 'fever'],
  'heart-attack': ['heart attack', 'chest pain', 'sina dard', 'cardiac emergency'],
  angina: ['angina', 'chest pain', 'heart pain'],
  acromegaly: [
    'acromegaly',
    'growth hormone excess',
    'enlarged hands',
    'enlarged feet',
    'facial changes',
    'pituitary tumour',
    'headache',
    'endocrinology',
    'IGF-1',
  ],
}

const ROMAN_URDU_GLOSS: Record<string, string> = {
  jaundice: 'peeli aankhen, zard jild, gehra peshab',
  dehydration: 'piyas, pani ki kami, kam paani, ORS',
  hepatitis: 'peeli aankhen, pet dard, kamzori',
  epilepsy: 'doray, fits, behoshi, chakkar',
  flu: 'bukhar, khansi, kamzori, jism ka dard',
  'common-cold': 'zukam, nazla, nak band',
  'urinary-tract-infections-utis': 'jalan peshab, urinary dard',
  'whooping-cough': 'tez khansi, bachon ki khansi',
  pneumonia: 'bukhar, khansi, sans lena mushkil',
  asthma: 'sans, ghatti saans, wheezing',
  'food-poisoning': 'ulti, dast, pet dard',
  gastroenteritis: 'ulti, dast, dehydration',
  migraine: 'sar dard, aankhon ke samne andhera',
  'heart-attack': 'seene mein dard, sans',
  'abdominal-aortic-aneurysm': 'pet ya kamar dard, pulse feel in tummy',
}

export function getConditionAliases(slug: string, conditionName: string): string[] {
  const curated = SLUG_ALIASES[slug]
  if (curated?.length) return [...new Set(curated)]

  const fromName = conditionName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
  const slugWords = slug.replace(/-/g, ' ')
  const words = conditionName.split(/\s+/).filter((w) => w.length > 3 && /^[A-Z]/.test(w))
  const acronym = words.map((w) => w[0]?.toLowerCase()).join('')
  const extra = acronym.length >= 2 && acronym.length <= 6 ? [acronym] : []
  return [...new Set([slugWords, conditionName.toLowerCase(), ...fromName, ...extra])]
}

export function getRomanUrduGloss(slug: string): string | null {
  return ROMAN_URDU_GLOSS[slug] ?? null
}
