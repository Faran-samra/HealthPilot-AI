import { Card, CardContent } from '@/components/ui/card'

export function DirectoryDoctorCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="flex gap-2 pt-2">
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        </div>
      </CardContent>
    </Card>
  )
}

export function DirectoryDoctorGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <DirectoryDoctorCardSkeleton key={i} />
      ))}
    </>
  )
}
