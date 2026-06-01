import type { AIAnalysisResult } from '@/lib/database.types'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  quickSeverity?: AIAnalysisResult['severity_level'] | null
}

export interface QuickTriageResult {
  severity: AIAnalysisResult['severity_level'] | null
  label: string
  isEmergency: boolean
  matchedKeywords: string[]
}

export interface SymptomChatFollowUp {
  type: 'follow_up'
  message: string
  quick_severity: AIAnalysisResult['severity_level'] | null
  trace_id?: string
}

export interface SymptomAnalysisExtended extends AIAnalysisResult {
  primary_condition?: string
  condition_confidence?: 'high' | 'medium' | 'low'
  brief_summary?: string
}

export interface SymptomChatAnalysis {
  type: 'analysis'
  analysis: SymptomAnalysisExtended
  trace_id?: string
}

export type SymptomChatResponse = SymptomChatFollowUp | SymptomChatAnalysis

export type SymptomCheckerPhase = 'chat' | 'results'
