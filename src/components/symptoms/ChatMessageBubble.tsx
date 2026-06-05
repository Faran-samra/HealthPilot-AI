import { useTranslation } from 'react-i18next'
import { Bot, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/symptomChat'
import { SEVERITY_CONFIG } from '@/utils/constants'
import { messageTextDirection } from '@/utils/romanUrdu'

interface ChatMessageBubbleProps {
  message: ChatMessage
  language: 'en' | 'ur'
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function ChatMessageBubble({ message, language }: ChatMessageBubbleProps) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const isGreeting = message.id === 'greeting'
  const severity = message.quickSeverity ? SEVERITY_CONFIG[message.quickSeverity] : null

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full shadow-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn('max-w-[88%] space-y-1.5 sm:max-w-[85%]', isUser && 'text-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
            isUser
              ? 'rounded-tr-md bg-primary text-primary-foreground'
              : 'rounded-tl-md border border-border/60 bg-card text-foreground',
            isGreeting && 'border-primary/20 bg-gradient-to-br from-primary/5 to-card'
          )}
          dir={messageTextDirection(message.content, language)}
        >
          {message.content}
        </div>
        {severity && !isUser && (
          <Badge className={cn('border text-xs font-normal', severity.bg)}>
            {t('symptoms.preliminarySeverity', { level: t(`severity.${message.quickSeverity}`) })}
          </Badge>
        )}
        {!isGreeting && (
          <p className={cn('text-[10px] text-muted-foreground', isUser && 'text-end')}>
            {formatTime(message.timestamp)}
          </p>
        )}
      </div>
    </div>
  )
}

interface ChatTypingIndicatorProps {
  label: string
}

export function ChatTypingIndicator({ label }: ChatTypingIndicatorProps) {
  return (
    <div className="flex gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="size-4" />
      </div>
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
          <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
          <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
        </span>
        {label}
      </div>
    </div>
  )
}

interface SymptomAnalysisLoadingProps {
  title: string
  hint: string
  steps: string[]
}

export function SymptomAnalysisLoading({ title, hint, steps }: SymptomAnalysisLoadingProps) {
  return (
    <div className="flex gap-3 animate-in fade-in duration-300">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Bot className="size-4" />
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-primary/20 bg-gradient-to-br from-primary/10 to-card p-4 shadow-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        <ul className="mt-3 space-y-2">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ul>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary/70" />
        </div>
      </div>
    </div>
  )
}
