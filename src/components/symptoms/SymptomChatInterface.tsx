import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HeartPulse, RotateCcw, Send, ShieldAlert, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ChatMessageBubble,
  ChatTypingIndicator,
  SymptomAnalysisLoading,
} from '@/components/symptoms/ChatMessageBubble'
import { AnalysisResultPanel } from '@/components/symptoms/AnalysisResultPanel'
import { useAuthStore } from '@/store/authStore'
import { useSymptomStore } from '@/store/symptomStore'
import {
  createMessageId,
  saveSymptomSession,
  sendSymptomChat,
} from '@/services/symptomChatService'
import { getQuickSymptomChips } from '@/utils/quickSymptomChips'
import { quickTriage, lookupSymptomCache } from '@/utils/symptomTriage'
import { useAutosizeTextarea } from '@/hooks/useAutosizeTextarea'
import { useCareLocation } from '@/hooks/useCareLocation'
import { cn } from '@/lib/utils'
import {
  detectConversationLanguage,
  detectUrduVariant,
  isRomanUrduText,
  messageTextDirection,
} from '@/utils/romanUrdu'
import {
  getGreetingText,
  greetingTextDirection,
} from '@/utils/symptomChatGreeting'

function countUserMessages(messages: { role: string }[]): number {
  return messages.filter((m) => m.role === 'user').length
}

function willRunAnalysis(
  userMessageCount: number,
  turnCount: number,
  forceFinalize: boolean
): boolean {
  return forceFinalize || turnCount >= 2 || userMessageCount >= 3
}

export function SymptomChatInterface() {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [loadingKind, setLoadingKind] = useState<'chat' | 'analysis' | null>(null)
  useAutosizeTextarea(inputRef, input, { minRows: 1, maxRows: 5 })

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
    setRagSources,
    ragSources,
    reset,
  } = useSymptomStore()

  const { careLocation, loading: careLocationLoading } = useCareLocation(
    profile?.city,
    true
  )

  const onlyGreeting = messages.length === 1 && messages[0]?.id === 'greeting'
  const visibleMessages = onlyGreeting
    ? messages.filter((m) => m.id !== 'greeting')
    : messages
  const userLinesForUi = messages.filter((m) => m.role === 'user').map((m) => m.content)
  const urduVariant = language === 'ur' ? detectUrduVariant(userLinesForUi) : null
  const usesRomanUrdu =
    language === 'ur' &&
    (urduVariant === 'roman' ||
      (urduVariant === 'mixed' && isRomanUrduText(userLinesForUi[userLinesForUi.length - 1] ?? '')))
  const greetingText = getGreetingText(language, usesRomanUrdu)
  const quickChips = getQuickSymptomChips(language, userLinesForUi)
  const isChatPhase = phase === 'chat'

  useEffect(() => {
    if (!isChatPhase) return
    const el = scrollContainerRef.current
    if (!el) return

    if (onlyGreeting && !isLoading) {
      el.scrollTo({ top: 0, behavior: 'instant' })
      return
    }

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    })
  }, [messages, isLoading, loadingKind, isChatPhase, onlyGreeting])

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

    const userMsgCount = countUserMessages(messages) + 1
    const finalize =
      forceFinalize ||
      triageResult.isEmergency ||
      willRunAnalysis(userMsgCount, turnCount, false)
    setLoadingKind(finalize ? 'analysis' : 'chat')
    setIsLoading(true)

    try {
      const allMessages = [...messages, userMsg]
      const userLines = allMessages.filter((m) => m.role === 'user').map((m) => m.content)
      const chatLanguage = detectConversationLanguage(userLines, language)
      if (chatLanguage !== language) setLanguage(chatLanguage)

      const response = await sendSymptomChat({
        messages: allMessages,
        language: chatLanguage,
        userAge: profile?.age ?? undefined,
        userGender: profile?.gender ?? undefined,
        turnCount,
        forceFinalize: finalize,
        clientTriage: triageResult,
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
        setAnalysis(response.analysis)
        setRagSources(response._rag?.sources ?? [])
        setPhase('results')

        if (user) {
          void saveSymptomSession({
            userId: user.id,
            symptoms: allMessages.filter((m) => m.role === 'user').map((m) => m.content),
            analysis: response.analysis,
            language: chatLanguage,
            chatTranscript: allMessages,
          })
            .then((session) => setSessionId(session.id))
            .catch(() => {})
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('symptoms.chatFailed'))
    } finally {
      setIsLoading(false)
      setLoadingKind(null)
    }
  }

  const handleFinalize = async () => {
    if (isLoading || countUserMessages(messages) === 0) return
    setLoadingKind('analysis')
    setIsLoading(true)
    try {
      const userLines = messages.filter((m) => m.role === 'user').map((m) => m.content)
      const chatLanguage = detectConversationLanguage(userLines, language)
      if (chatLanguage !== language) setLanguage(chatLanguage)

      const response = await sendSymptomChat({
        messages,
        language: chatLanguage,
        userAge: profile?.age ?? undefined,
        userGender: profile?.gender ?? undefined,
        turnCount,
        forceFinalize: true,
        clientTriage: triage,
      })
      if (response.type === 'analysis') {
        setAnalysis(response.analysis)
        setRagSources(response._rag?.sources ?? [])
        setPhase('results')
        if (user) {
          void saveSymptomSession({
            userId: user.id,
            symptoms: messages.filter((m) => m.role === 'user').map((m) => m.content),
            analysis: response.analysis,
            language: chatLanguage,
            chatTranscript: messages,
          })
            .then((session) => setSessionId(session.id))
            .catch(() => {})
        }
      } else if (response.type === 'follow_up') {
        addMessage({
          id: createMessageId(),
          role: 'assistant',
          content: response.message,
          timestamp: Date.now(),
          quickSeverity: response.quick_severity,
        })
        toast.message(t('symptoms.needMoreInfo'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('symptoms.chatFailed'))
    } finally {
      setIsLoading(false)
      setLoadingKind(null)
    }
  }

  const handleNewChat = () => {
    reset(language)
    setInput('')
    setLoadingKind(null)
  }

  const inputPlaceholder =
    language === 'en'
      ? t('symptoms.chatPlaceholderEn')
      : usesRomanUrdu
        ? t('symptoms.chatPlaceholderRomanUr')
        : t('symptoms.chatPlaceholderUr')

  if (!isChatPhase && analysis) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('symptoms.resultsTitle')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('symptoms.resultsSubtitle')}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNewChat}>
            <RotateCcw className="size-3.5" />
            {t('symptoms.newChat')}
          </Button>
        </div>
        <AnalysisResultPanel
          analysis={analysis}
          ragSources={ragSources}
          careLocation={careLocation}
          locationLoading={careLocationLoading}
          area={profile?.area}
          traceId={lastTraceId}
          sessionId={sessionId}
          showFullDetails
        />
        <p className="mt-8 text-center text-xs text-muted-foreground">{t('symptoms.disclaimer')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col overflow-hidden px-4 py-3 sm:px-6">
      {/* Top bar */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold md:text-xl">{t('symptoms.title')}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {onlyGreeting ? t('symptoms.pageBadge') : t('symptoms.chatSubtitle')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={language === 'en' ? 'default' : 'ghost'}
              className="h-7 px-2.5 text-xs"
              onClick={() => setLanguage('en')}
            >
              EN
            </Button>
            <Button
              size="sm"
              variant={language === 'ur' ? 'default' : 'ghost'}
              className="h-7 px-2.5 text-xs"
              onClick={() => setLanguage('ur')}
            >
              اردو
            </Button>
          </div>
          {!onlyGreeting && (
            <Button variant="ghost" size="icon" className="size-8" onClick={handleNewChat}>
              <RotateCcw className="size-4" />
              <span className="sr-only">{t('symptoms.newChat')}</span>
            </Button>
          )}
        </div>
      </div>

      {triage?.isEmergency && (
        <div className="mb-3 shrink-0 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          <ShieldAlert className="mb-1 inline size-4" /> {t('symptoms.emergencyText')}
        </div>
      )}

      {/* Chat — one scroll area only */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border shadow-sm">
        {!onlyGreeting && (
          <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <HeartPulse className="size-4" />
            </div>
            <p className="text-sm font-medium">HealthPilot AI</p>
            {stagedSeverity && !triage?.isEmergency && (
              <span className="ms-auto text-xs text-muted-foreground">
                {t('symptoms.preliminarySeverity', { level: t(`severity.${stagedSeverity}`) })}
              </span>
            )}
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/10 p-3 sm:p-4"
        >
          <div className="space-y-4">
            {onlyGreeting && !isLoading && (
              <div className="rounded-xl border border-primary/15 bg-gradient-to-b from-primary/[0.07] to-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <HeartPulse className="size-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="font-semibold leading-tight">HealthPilot AI</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('symptoms.pageBadge')}</p>
                  </div>
                </div>

                <p
                  className="text-sm leading-relaxed text-foreground"
                  dir={greetingTextDirection(language, usesRomanUrdu)}
                >
                  {greetingText}
                </p>

                <ol className="mt-4 flex flex-wrap gap-2 text-xs" aria-label={t('symptoms.title')}>
                  {(['stepDescribe', 'stepChat', 'stepResults'] as const).map((key, i) => (
                    <li
                      key={key}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-muted-foreground',
                        i === 0 && 'border-primary/30 text-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 items-center justify-center rounded-full text-[10px] font-semibold',
                          i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}
                      >
                        {i + 1}
                      </span>
                      {t(`symptoms.${key}`)}
                    </li>
                  ))}
                </ol>

                <p className="mt-4 text-xs font-medium text-muted-foreground">
                  {usesRomanUrdu
                    ? t('symptoms.quickSymptomsRoman')
                    : t('symptoms.quickSymptoms')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {quickChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="rounded-full border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
                      onClick={() => handleSend(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleMessages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} language={language} />
            ))}

            {isLoading && loadingKind === 'analysis' && (
              <SymptomAnalysisLoading
                title={t('symptoms.preparingResults')}
                hint={t('symptoms.preparingResultsHint')}
                steps={[
                  t('symptoms.analysisStep1'),
                  t('symptoms.analysisStep2'),
                  t('symptoms.analysisStep3'),
                ]}
              />
            )}
            {isLoading && loadingKind === 'chat' && (
              <ChatTypingIndicator label={t('symptoms.aiThinking')} />
            )}
            <div ref={messagesEndRef} aria-hidden />
          </div>
        </div>

        {/* Composer — fixed height, no inner scroll */}
        <div className="shrink-0 border-t bg-card p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-relaxed outline-none"
              placeholder={inputPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              dir={
                language === 'ur'
                  ? usesRomanUrdu
                    ? 'ltr'
                    : 'rtl'
                  : messageTextDirection(input, language)
              }
              disabled={isLoading}
              aria-label={t('symptoms.yourSymptoms')}
            />
            <Button
              size="icon"
              className="size-10 shrink-0"
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              aria-label={t('symptoms.send')}
            >
              <Send className="size-4" />
            </Button>
          </div>
          {turnCount >= 1 && (
            <Button
              variant="link"
              size="sm"
              className="mt-1 h-auto w-full p-0 text-xs text-muted-foreground"
              onClick={handleFinalize}
              disabled={isLoading}
            >
              <Sparkles className="me-1 inline size-3" />
              {turnCount >= 2 ? t('symptoms.getResultsNowFast') : t('symptoms.getResultsNow')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
