import { detectUrduVariant, isRomanUrduText } from '@/utils/romanUrdu'

/** Example prompts for the symptom checker — localized. */
export const QUICK_SYMPTOM_CHIPS: Record<'en' | 'ur', readonly string[]> = {
  en: [
    'Fever and headache for 2 days',
    'Persistent cough and sore throat',
    'Chest pain when breathing',
    'Stomach pain and nausea',
    'Skin rash and itching',
    'Dizziness and weakness',
    'Back pain for a week',
    'Burning when urinating',
  ],
  ur: [
    '2 دن سے بخار اور سر درد',
    'کھانسی اور گلے میں خراش',
    'سانس پر سینے میں درد',
    'پیٹ درد اور متلی',
    'جلد پر خارش اور داغ',
    'چکر آنا اور کمزوری',
    'ایک ہفتے سے کمر درد',
    'پیشاب میں جلن',
  ],
}

/** Roman Urdu chips when user writes in Latin script (not Urdu Nastaliq). */
export const QUICK_SYMPTOM_CHIPS_ROMAN: readonly string[] = [
  '2 din se bukhar aur sar dard',
  'khansi aur gale mein kharash',
  'saans par sine mein dard',
  'pet dard aur matli',
  'jild par khujli aur daagh',
  'chakkar ana aur kamzori',
  'ek hafte se kamar dard',
  'peshab mein jalan',
]

export function getQuickSymptomChips(
  language: 'en' | 'ur',
  userLines: string[] = []
): string[] {
  if (language === 'en') return [...QUICK_SYMPTOM_CHIPS.en]
  const variant = detectUrduVariant(userLines)
  const lastUser = userLines[userLines.length - 1] ?? ''
  if (variant === 'roman' || (variant === 'mixed' && isRomanUrduText(lastUser))) {
    return [...QUICK_SYMPTOM_CHIPS_ROMAN]
  }
  return [...QUICK_SYMPTOM_CHIPS.ur]
}
