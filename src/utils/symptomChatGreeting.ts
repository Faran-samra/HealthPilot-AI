import type { ChatMessage } from '@/types/symptomChat'

const GREETING = {
  en: "Assalam o Alaikum! I'm HealthPilot AI, your private symptom guide for Pakistan. Tell me what's bothering you — how long it's been going on and how it affects your day. I'll ask a few short, relevant questions, then suggest the right type of doctor. This is guidance only, not a diagnosis.",
  ur: 'السلام علیکم! میں HealthPilot AI ہوں — پاکستان کے لیے آپ کا symptom guide۔ بتائیں کیا تکلیف ہے، کب سے ہے، اور کتنی شدید ہے۔ میں چند سوالات پوچھوں گا، پھر بتاؤں گا کس ماہر ڈاکٹر سے ملنا چاہیے۔ یہ رہنمائی ہے، تشخیص نہیں۔',
  urRoman:
    'Assalam o Alaikum! Main HealthPilot AI hoon — Pakistan ke liye aap ka private symptom guide. Batain kya takleef hai, kitne din se hai, aur din par asar. Main chand short sawal poochunga, phir sahi doctor ki qisam suggest karunga. Yeh sirf rehnumai hai, diagnosis nahi.',
} as const

export function createGreetingMessage(language: 'en' | 'ur'): ChatMessage {
  return {
    id: 'greeting',
    role: 'assistant',
    content: GREETING[language],
    timestamp: Date.now(),
  }
}

export function getGreetingText(language: 'en' | 'ur', romanUrdu = false): string {
  if (language === 'ur' && romanUrdu) return GREETING.urRoman
  return GREETING[language]
}

export function greetingTextDirection(language: 'en' | 'ur', romanUrdu: boolean): 'ltr' | 'rtl' {
  if (language === 'ur' && !romanUrdu) return 'rtl'
  return 'ltr'
}
