import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { submitReview } from '@/services/reviewService'
import { cn } from '@/lib/utils'

interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointmentId: string
  patientId: string
  doctorId: string
  doctorName: string
  onSubmitted?: () => void
}

export function ReviewDialog({
  open,
  onOpenChange,
  appointmentId,
  patientId,
  doctorId,
  doctorName,
  onSubmitted,
}: ReviewDialogProps) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error(t('dashboard.reviewRatingRequired'))
      return
    }

    setSubmitting(true)
    try {
      await submitReview({
        appointmentId,
        patientId,
        doctorId,
        rating,
        comment: comment.trim() || undefined,
        isAnonymous,
      })
      toast.success(t('dashboard.reviewSubmitted'))
      onOpenChange(false)
      setRating(0)
      setComment('')
      setIsAnonymous(false)
      onSubmitted?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.reviewFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dashboard.reviewTitle')}</DialogTitle>
          <DialogDescription>
            {t('dashboard.reviewDesc', { doctor: doctorName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block">{t('dashboard.yourRating')}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  className="rounded p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'size-7',
                      (hover || rating) >= star
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="review-comment">{t('dashboard.reviewComment')}</Label>
            <textarea
              id="review-comment"
              className="mt-2 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={t('dashboard.reviewCommentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="size-4 rounded border"
            />
            {t('dashboard.reviewAnonymous')}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('common.loading') : t('dashboard.submitReview')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
