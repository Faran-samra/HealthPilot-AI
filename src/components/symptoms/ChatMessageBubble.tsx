import { Bot, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/symptomChat'
import { SEVERITY_CONFIG } from '@/utils/constants'

interface ChatMessageBubbleProps {
  message: ChatMessage
  language: 'en' | 'ur'
}

export function ChatMessageBubble({ message, language }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'
  const severity = message.quickSeverity ? SEVERITY_CONFIG[message.quickSeverity] : null

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn('max-w-[85%] space-y-1', isUser && 'text-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted text-foreground'
          )}
          dir={!isUser && language === 'ur' ? 'rtl' : undefined}
        >
          {message.content}
        </div>
        {severity && !isUser && (
          <Badge className={cn('border text-xs', severity.bg)}>
            Preliminary: {severity.label}
          </Badge>
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
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="size-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
        <span className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
        </span>
        {label}
      </div>
    </div>
  )
}
