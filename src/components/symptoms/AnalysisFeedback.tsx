import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface AnalysisFeedbackProps {
  traceId?: string | null
  sessionId?: string | null
}

export function AnalysisFeedback({ traceId, sessionId }: AnalysisFeedbackProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [submitted, setSubmitted] = useState<-1 | 1 | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(rating: -1 | 1) {
    if (submitted != null) return
    setLoading(true)
    try {
      const { error } = await supabase.from('analysis_feedback').insert({
        trace_id: traceId ?? null,
        session_id: sessionId ?? null,
        user_id: user?.id ?? null,
        rating,
        comment: null,
      })
      if (error) throw error
      setSubmitted(rating)
      toast.success(t('symptoms.feedbackThanks'))
    } catch {
      toast.error(t('symptoms.feedbackError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      <span className="text-sm text-muted-foreground">{t('symptoms.feedbackPrompt')}</span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={submitted === 1 ? 'default' : 'outline'}
          className="gap-1"
          disabled={loading || submitted != null}
          onClick={() => submit(1)}
        >
          <ThumbsUp className="size-3.5" />
          {t('symptoms.feedbackHelpful')}
        </Button>
        <Button
          size="sm"
          variant={submitted === -1 ? 'default' : 'outline'}
          className="gap-1"
          disabled={loading || submitted != null}
          onClick={() => submit(-1)}
        >
          <ThumbsDown className="size-3.5" />
          {t('symptoms.feedbackNotHelpful')}
        </Button>
      </div>
    </div>
  )
}
