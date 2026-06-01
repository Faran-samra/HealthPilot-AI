import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Send, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ChatMessageBubble, ChatTypingIndicator } from '@/components/symptoms/ChatMessageBubble'
import { AnalysisResultPanel } from '@/components/symptoms/AnalysisResultPanel'
import { useAuthStore } from '@/store/authStore'
import { useSymptomStore } from '@/store/symptomStore'
import {
  createMessageId,
  saveSymptomSession,
  sendSymptomChat,
} from '@/services/symptomChatService'
import { QUICK_SYMPTOMS, SEVERITY_CONFIG } from '@/utils/constants'
import { quickTriage, lookupSymptomCache } from '@/utils/symptomTriage'
import { useAutosizeTextarea } from '@/hooks/useAutosizeTextarea'
import { useCareLocation } from '@/hooks/useCareLocation'
import { cn } from '@/lib/utils'

export function SymptomChatInterface() {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  useAutosizeTextarea(inputRef, input, { minRows: 2, maxRows: 8 })

  const {
    language,
    messages,
    analysis,
    sessionId,
    lastTraceId,
    phase,
    isLoading,
    turnCount,
    quickTriage: triage,
    stagedSeverity,
    setLanguage,
    addMessage,
    setAnalysis,
    setSessionId,
    setLastTraceId,
    setPhase,
    setIsLoading,
    incrementTurn,
    setQuickTriage,
    setStagedSeverity,
    reset,
  } = useSymptomStore()

  const { careLocation, loading: careLocationLoading } = useCareLocation(
    profile?.city,
    true
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading, phase, analysis])

  const handleSend = async (text?: string, forceFinalize = false) => {
    const content = (text ?? input).trim()
    if (!content || isLoading) return

    setInput('')

    const triageResult = quickTriage(content)
    setQuickTriage(triageResult)
    if (triageResult.severity) setStagedSeverity(triageResult.severity)

    const cached = lookupSymptomCache(content)
    if (cached && !forceFinalize) {
      setStagedSeverity(cached.severity_level)
    }

    const userMsg = {
      id: createMessageId(),
      role: 'user' as const,
      content,
      timestamp: Date.now(),
    }
    addMessage(userMsg)
    setIsLoading(true)

    try {
      const allMessages = [...messages, userMsg]
      const response = await sendSymptomChat({
        messages: allMessages,
        language,
        userAge: profile?.age ?? undefined,
        userGender: profile?.gender ?? undefined,
        turnCount,
        forceFinalize: forceFinalize || triageResult.isEmergency,
      })

      if (response.trace_id) setLastTraceId(response.trace_id)

      if (response.type === 'follow_up') {
        addMessage({
          id: createMessageId(),
          role: 'assistant',
          content: response.message,
          timestamp: Date.now(),
          quickSeverity: response.quick_severity,
        })
        if (response.quick_severity) setStagedSeverity(response.quick_severity)
        incrementTurn()
      } else {
        if (response.trace_id) setLastTraceId(response.trace_id)
        setAnalysis(response.analysis)
        setPhase('results')

        if (user) {
          const session = await saveSymptomSession({
            userId: user.id,
            symptoms: allMessages
              .filter((m) => m.role === 'user')
              .map((m) => m.content),
            analysis: response.analysis,
            language,
            chatTranscript: allMessages,
          })
          setSessionId(session.id)
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('symptoms.chatFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinalize = async () => {
    if (isLoading || messages.filter((m) => m.role === 'user').length === 0) return
    setIsLoading(true)
    try {
      const response = await sendSymptomChat({
        messages,
        language,
        userAge: profile?.age ?? undefined,
        userGender: profile?.gender ?? undefined,
        turnCount,
        forceFinalize: true,
      })
      if (response.type === 'analysis') {
        if (response.trace_id) setLastTraceId(response.trace_id)
        setAnalysis(response.analysis)
        setPhase('results')
        if (user) {
          const session = await saveSymptomSession({
            userId: user.id,
            symptoms: messages.filter((m) => m.role === 'user').map((m) => m.content),
            analysis: response.analysis,
            language,
            chatTranscript: messages,
          })
          setSessionId(session.id)
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('symptoms.chatFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewChat = () => {
    reset(language)
  }

  const stagedConfig = stagedSeverity ? SEVERITY_CONFIG[stagedSeverity] : null

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-6 md:py-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">{t('symptoms.title')}</h1>
        <div className="flex gap-1 rounded-lg border p-1">
          <Button size="xs" variant={language === 'en' ? 'default' : 'ghost'} onClick={() => setLanguage('en')}>
            EN
          </Button>
          <Button size="xs" variant={language === 'ur' ? 'default' : 'ghost'} onClick={() => setLanguage('ur')}>
            UR
          </Button>
        </div>
      </div>

      {stagedConfig && phase === 'chat' && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm animate-in fade-in duration-300">
          <Zap className="size-4 text-primary" />
          <span>{t('symptoms.quickAssessment')}:</span>
          <Badge className={cn('border text-xs', stagedConfig.bg)}>
            {t(`severity.${stagedSeverity}`)}
          </Badge>
          {triage?.isEmergency && (
            <span className="text-xs text-red-600">{t('symptoms.emergencyHint')}</span>
          )}
        </div>
      )}

      <Card className="flex min-h-[420px] flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} language={language} />
          ))}
          {isLoading && (
            <ChatTypingIndicator label={t('symptoms.aiThinking')} />
          )}
        </div>

        {phase === 'chat' && (
          <div className="border-t p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SYMPTOMS.slice(0, 6).map((chip) => (
                <Badge
                  key={chip}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-muted"
                  onClick={() => handleSend(chip)}
                >
                  {chip}
                </Badge>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                className="min-h-[52px] max-h-[200px] flex-1 resize-none overflow-hidden rounded-xl border bg-background px-3 py-3 text-sm leading-relaxed outline-none transition-[height] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={language === 'ur' ? t('symptoms.chatPlaceholderUr') : t('symptoms.chatPlaceholderEn')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                dir={language === 'ur' ? 'rtl' : 'ltr'}
                disabled={isLoading}
                aria-label={t('symptoms.yourSymptoms')}
              />
              <Button
                size="icon"
                className="shrink-0 self-end"
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
              >
                <Send className="size-4" />
              </Button>
            </div>

            {turnCount >= 1 && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full gap-2"
                onClick={handleFinalize}
                disabled={isLoading}
              >
                <Sparkles className="size-3.5" />
                {t('symptoms.getResultsNow')}
              </Button>
            )}

            <p className="text-center text-xs text-muted-foreground">{t('symptoms.disclaimer')}</p>
          </div>
        )}
      </Card>

      {phase === 'results' && analysis && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('symptoms.resultsTitle')}</h2>
            <Button variant="ghost" size="sm" className="gap-1" onClick={handleNewChat}>
              <RotateCcw className="size-3.5" />
              {t('symptoms.newChat')}
            </Button>
          </div>
          <AnalysisResultPanel
            analysis={analysis}
            careLocation={careLocation}
            locationLoading={careLocationLoading}
            area={profile?.area}
            traceId={lastTraceId}
            sessionId={sessionId}
            showFullDetails
          />
        </div>
      )}
    </div>
  )
}
