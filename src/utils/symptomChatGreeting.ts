import type { ChatMessage } from '@/types/symptomChat'

const GREETING = {
  en: "Assalam o Alaikum! I'm HealthPilot AI, your symptom guide for Pakistan. Describe what's bothering you — how long it's been going on, and how severe it feels. I'll ask a few follow-up questions, then suggest which type of doctor to see. This is guidance only, not a diagnosis.",
  ur: 'السلام علیکم! میں HealthPilot AI ہوں — پاکستان کے لیے آپ کا symptom guide۔ بتائیں کیا تکلیف ہے، کب سے ہے، اور کتنی شدید ہے۔ میں چند سوالات پوچھوں گا، پھر بتاؤں گا کس ماہر ڈاکٹر سے ملنا چاہیے۔ یہ رہنمائی ہے، تشخیص نہیں۔',
} as const

export function createGreetingMessage(language: 'en' | 'ur'): ChatMessage {
  return {
    id: 'greeting',
    role: 'assistant',
    content: GREETING[language],
    timestamp: Date.now(),
  }
}

export function getGreetingText(language: 'en' | 'ur'): string {
  return GREETING[language]
}
