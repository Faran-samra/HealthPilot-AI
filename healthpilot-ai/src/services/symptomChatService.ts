import { supabase } from '@/lib/supabase'
import type { AIAnalysisResult, Json } from '@/lib/database.types'
import type { ChatMessage, SymptomAnalysisExtended, SymptomChatResponse } from '@/types/symptomChat'
import { FunctionsHttpError } from '@supabase/supabase-js'

async function readFunctionError(error: FunctionsHttpError): Promise<string> {
  try {
    const context = error.context as Response | undefined
    if (context) {
      const body = await context.json().catch(() => null)
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error
      }
    }
  } catch {
    // ignore
  }
  return error.message
}

export interface SymptomChatParams {
  messages: ChatMessage[]
  language: 'en' | 'ur'
  userAge?: number
  userGender?: string
  turnCount: number
  forceFinalize?: boolean
}

export async function sendSymptomChat(params: SymptomChatParams): Promise<SymptomChatResponse> {
  const { data, error } = await supabase.functions.invoke<SymptomChatResponse>('symptom-chat', {
    body: {
      messages: params.messages.map(({ role, content }) => ({ role, content })),
      language: params.language,
      userAge: params.userAge,
      userGender: params.userGender,
      turnCount: params.turnCount,
      forceFinalize: params.forceFinalize ?? false,
    },
  })

  if (error) {
    if (error instanceof FunctionsHttpError) {
      throw new Error(await readFunctionError(error))
    }
    throw error
  }

  if (!data) throw new Error('Empty response from symptom chat')
  if ('error' in data && typeof (data as { error: string }).error === 'string') {
    throw new Error((data as { error: string }).error)
  }

  return data
}

/** Legacy single-shot analysis — kept for backward compatibility. */
export async function analyzeSymptoms(params: {
  symptoms: string
  language: 'en' | 'ur'
  userAge?: number
  userGender?: string
}): Promise<AIAnalysisResult> {
  const response = await sendSymptomChat({
    messages: [{ id: '1', role: 'user', content: params.symptoms, timestamp: Date.now() }],
    language: params.language,
    userAge: params.userAge,
    userGender: params.userGender,
    turnCount: 99,
    forceFinalize: true,
  })

  if (response.type !== 'analysis') {
    throw new Error('Expected analysis result')
  }
  return response.analysis
}

export async function saveSymptomSession({
  userId,
  symptoms,
  analysis,
  language,
  chatTranscript,
}: {
  userId?: string
  symptoms: string[]
  analysis: SymptomAnalysisExtended
  language: 'en' | 'ur'
  chatTranscript?: ChatMessage[]
}) {
  const enriched = {
    ...analysis,
    chat_transcript: chatTranscript?.map(({ role, content }) => ({ role, content })),
  }

  const { data, error } = await supabase
    .from('symptom_sessions')
    .insert({
      user_id: userId ?? null,
      symptoms_reported: symptoms,
      ai_analysis: enriched as unknown as Json,
      suggested_specialty: analysis.recommended_specialty,
      suggested_specialty_slug: analysis.recommended_specialty_slug,
      severity_level: analysis.severity_level,
      language_used: language,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
