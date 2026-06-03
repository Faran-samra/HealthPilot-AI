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

export function getQuickSymptomChips(language: 'en' | 'ur'): string[] {
  return [...QUICK_SYMPTOM_CHIPS[language]]
}
