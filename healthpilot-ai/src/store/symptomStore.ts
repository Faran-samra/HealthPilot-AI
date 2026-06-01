import { create } from 'zustand'
import type { SymptomAnalysisExtended } from '@/types/symptomChat'
import type { ChatMessage, SymptomCheckerPhase } from '@/types/symptomChat'
import type { QuickTriageResult } from '@/types/symptomChat'
import { createGreetingMessage } from '@/utils/symptomChatGreeting'

interface SymptomStore {
  language: 'en' | 'ur'
  messages: ChatMessage[]
  analysis: SymptomAnalysisExtended | null
  sessionId: string | null
  lastTraceId: string | null
  phase: SymptomCheckerPhase
  isLoading: boolean
  turnCount: number
  quickTriage: QuickTriageResult | null
  stagedSeverity: SymptomAnalysisExtended['severity_level'] | null

  setLanguage: (language: 'en' | 'ur') => void
  addMessage: (message: ChatMessage) => void
  setMessages: (messages: ChatMessage[]) => void
  setAnalysis: (analysis: SymptomAnalysisExtended | null) => void
  setSessionId: (id: string | null) => void
  setLastTraceId: (id: string | null) => void
  setPhase: (phase: SymptomCheckerPhase) => void
  setIsLoading: (value: boolean) => void
  incrementTurn: () => void
  setQuickTriage: (result: QuickTriageResult | null) => void
  setStagedSeverity: (severity: SymptomAnalysisExtended['severity_level'] | null) => void
  reset: (language?: 'en' | 'ur') => void
}

export const useSymptomStore = create<SymptomStore>((set, get) => ({
  language: 'en',
  messages: [createGreetingMessage('en')],
  analysis: null,
  sessionId: null,
  lastTraceId: null,
  phase: 'chat',
  isLoading: false,
  turnCount: 0,
  quickTriage: null,
  stagedSeverity: null,

  setLanguage: (language) =>
    set((s) => {
      const onlyGreeting =
        s.messages.length === 1 &&
        s.messages[0].role === 'assistant' &&
        s.messages[0].id === 'greeting'
      return {
        language,
        messages: onlyGreeting ? [createGreetingMessage(language)] : s.messages,
      }
    }),

  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setAnalysis: (analysis) => set({ analysis }),
  setSessionId: (sessionId) => set({ sessionId }),
  setLastTraceId: (lastTraceId) => set({ lastTraceId }),
  setPhase: (phase) => set({ phase }),
  setIsLoading: (isLoading) => set({ isLoading }),
  incrementTurn: () => set((s) => ({ turnCount: s.turnCount + 1 })),
  setQuickTriage: (quickTriage) => set({ quickTriage }),
  setStagedSeverity: (stagedSeverity) => set({ stagedSeverity }),

  reset: (language) => {
    const lang = language ?? get().language
    set({
      messages: [createGreetingMessage(lang)],
      analysis: null,
      sessionId: null,
      lastTraceId: null,
      phase: 'chat',
      isLoading: false,
      turnCount: 0,
      quickTriage: null,
      stagedSeverity: null,
    })
  },
}))
