import type { ChatMessage } from '@/types/symptomChat'

const GREETING = {
  en: "Assalam o Alaikum! I'm HealthPilot AI. Tell me how you're feeling — describe your symptoms.",
  ur: 'السلام علیکم! میں HealthPilot AI ہوں۔ بتائیں آپ کیسا محسوس کر رہے ہیں — اپنی علامات بیان کریں۔',
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
