import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  HeartPulse,
  Info,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { SEVERITY_CONFIG } from '@/utils/constants'
import { getQuickSymptomChips } from '@/utils/quickSymptomChips'
import { quickTriage, lookupSymptomCache } from '@/utils/symptomTriage'
import { useAutosizeTextarea } from '@/hooks/useAutosizeTextarea'
import { useCareLocation } from '@/hooks/useCareLocation'
import { cn } from '@/lib/utils'

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

function SymptomProgress({ phase, turnCount }: { phase: 'chat' | 'results'; turnCount: number }) {
  const { t } = useTranslation()
  const steps = [
    { key: 'describe', label: t('symptoms.stepDescribe') },
    { key: 'chat', label: t('symptoms.stepChat') },
    { key: 'results', label: t('symptoms.stepResults') },
  ]
  const activeIndex = phase === 'results' ? 2 : turnCount > 0 ? 1 : 0

  return (
    <ol className="mb-6 flex gap-1 sm:gap-2">
      {steps.map((step, i) => (
        <li key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className={cn(
              'flex h-8 w-full max-w-[8rem] items-center justify-center rounded-full text-xs font-medium transition-colors',
              i <= activeIndex
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {i + 1}
          </div>
          <span
            className={cn(
              'hidden text-center text-[10px] leading-tight sm:block sm:text-xs',
              i <= activeIndex ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function SymptomChatInterface() {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [loadingKind, setLoadingKind] = useState<'chat' | 'analysis' | null>(null)
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

  const onlyGreeting = messages.length === 1 && messages[0]?.id === 'greeting'
  const quickChips = getQuickSymptomChips(language)
  const stagedConfig = stagedSeverity ? SEVERITY_CONFIG[stagedSeverity] : null

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

    const userMsgCount = countUserMessages(messages) + 1
    const finalize =
      forceFinalize ||
      triageResult.isEmergency ||
      willRunAnalysis(userMsgCount, turnCount, false)
    setLoadingKind(finalize ? 'analysis' : 'chat')
    setIsLoading(true)

    try {
      const allMessages = [...messages, userMsg]
      const response = await sendSymptomChat({
        messages: allMessages,
        language,
        userAge: profile?.age ?? undefined,
        userGender: profile?.gender ?? undefined,
        turnCount,
        forceFinalize: finalize,
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
          void saveSymptomSession({
            userId: user.id,
            symptoms: allMessages
              .filter((m) => m.role === 'user')
              .map((m) => m.content),
            analysis: response.analysis,
            language,
            chatTranscript: allMessages,
          })
            .then((session) => setSessionId(session.id))
            .catch(() => {
              /* non-blocking — results already visible */
            })
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
          void saveSymptomSession({
            userId: user.id,
            symptoms: messages.filter((m) => m.role === 'user').map((m) => m.content),
            analysis: response.analysis,
            language,
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

  const userMessageCount = countUserMessages(messages)
  const nextSendFinalizes = willRunAnalysis(userMessageCount + 1, turnCount, false)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <HeartPulse className="size-3.5" />
            {t('symptoms.pageBadge')}
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('symptoms.title')}</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground md:text-base">
            {t('symptoms.pageSubtitle')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          <div className="flex gap-0.5 rounded-lg border bg-muted/30 p-0.5">
            <Button
              size="sm"
              variant={language === 'en' ? 'default' : 'ghost'}
              className="h-8 px-3 text-xs"
              onClick={() => setLanguage('en')}
            >
              English
            </Button>
            <Button
              size="sm"
              variant={language === 'ur' ? 'default' : 'ghost'}
              className="h-8 px-3 text-xs"
              onClick={() => setLanguage('ur')}
            >
              اردو
            </Button>
          </div>
          {phase === 'chat' && !onlyGreeting && (
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleNewChat}>
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">{t('symptoms.newChat')}</span>
            </Button>
          )}
        </div>
      </div>

      <SymptomProgress phase={phase} turnCount={turnCount} />

      {triage?.isEmergency && phase === 'chat' && (
        <Card className="mb-4 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
          <div className="flex items-start gap-3 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200">
                {t('symptoms.emergencyTitle')}
              </p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {t('symptoms.emergencyText')}
              </p>
            </div>
          </div>
        </Card>
      )}

      {stagedConfig && phase === 'chat' && !triage?.isEmergency && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-4 py-2.5 text-sm animate-in fade-in duration-300">
          <Zap className="size-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">{t('symptoms.quickAssessment')}:</span>
          <Badge className={cn('border text-xs', stagedConfig.bg)}>
            {t(`severity.${stagedSeverity}`)}
          </Badge>
          <span className="text-xs text-muted-foreground">{t('symptoms.stagedHint')}</span>
        </div>
      )}

      <Card className="flex flex-col overflow-hidden border shadow-md">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b bg-gradient-to-r from-primary/8 via-background to-teal-500/5 px-4 py-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <HeartPulse className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">HealthPilot AI</p>
            <p className="truncate text-xs text-muted-foreground">{t('symptoms.chatSubtitle')}</p>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex min-h-[min(380px,calc(100dvh-22rem))] flex-1 flex-col space-y-4 overflow-y-auto bg-muted/15 p-4 md:min-h-[420px]"
        >
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} language={language} />
          ))}

          {onlyGreeting && phase === 'chat' && !isLoading && (
            <div className="rounded-xl border border-dashed border-primary/25 bg-card/80 p-4 animate-in fade-in duration-500">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="size-4 text-primary" />
                {t('symptoms.welcomeTipsTitle')}
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  {t('symptoms.welcomeTip1')}
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  {t('symptoms.welcomeTip2')}
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  {t('symptoms.welcomeTip3')}
                </li>
              </ul>
            </div>
          )}

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
        </div>

        {phase === 'chat' && (
          <div className="space-y-3 border-t bg-card p-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t('symptoms.quickSymptoms')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={isLoading}
                    className="rounded-full border bg-background px-3 py-1.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                    onClick={() => handleSend(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-2 rounded-xl border bg-muted/20 p-2 focus-within:ring-2 focus-within:ring-ring/50">
              <textarea
                ref={inputRef}
                rows={1}
                className="min-h-[48px] max-h-[200px] flex-1 resize-none overflow-hidden bg-transparent px-2 py-2.5 text-sm leading-relaxed outline-none"
                placeholder={
                  language === 'ur' ? t('symptoms.chatPlaceholderUr') : t('symptoms.chatPlaceholderEn')
                }
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
                className="size-10 shrink-0 rounded-lg shadow-sm"
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                aria-label={t('symptoms.send')}
              >
                <Send className="size-4" />
              </Button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              {nextSendFinalizes && !isLoading
                ? t('symptoms.nextMessageFinalizes')
                : t('symptoms.sendHint')}
            </p>

            {turnCount >= 2 && !isLoading && (
              <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-center text-xs text-muted-foreground">
                {t('symptoms.readyForResults')}
              </p>
            )}

            {turnCount >= 1 && (
              <Button
                variant={turnCount >= 2 ? 'default' : 'secondary'}
                size="sm"
                className="w-full gap-2"
                onClick={handleFinalize}
                disabled={isLoading}
              >
                <Sparkles className="size-3.5" />
                {turnCount >= 2 ? t('symptoms.getResultsNowFast') : t('symptoms.getResultsNow')}
              </Button>
            )}

            <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-center text-[11px] leading-relaxed text-muted-foreground">
              <ShieldAlert className="mx-auto size-3.5 shrink-0 sm:mx-0" />
              {t('symptoms.disclaimer')}
            </p>
          </div>
        )}
      </Card>

      {phase === 'results' && analysis && (
        <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{t('symptoms.resultsTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('symptoms.resultsSubtitle')}</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleNewChat}>
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
