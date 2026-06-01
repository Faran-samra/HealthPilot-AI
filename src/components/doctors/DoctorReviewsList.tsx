import { useTranslation } from 'react-i18next'
import { Star, User } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Review } from '@/lib/database.types'

interface DoctorReviewsListProps {
  reviews: Review[]
}

export function DoctorReviewsList({ reviews }: DoctorReviewsListProps) {
  const { t } = useTranslation()

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('dashboard.noReviewsYet')}</p>
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" />
                {review.is_anonymous ? t('dashboard.anonymousPatient') : t('dashboard.patient')}
              </div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-3.5 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                  />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {review.comment && (
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {format(new Date(review.created_at), 'dd MMM yyyy')}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
