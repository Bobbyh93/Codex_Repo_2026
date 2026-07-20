import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// Enhanced shimmer skeleton with animation
function ShimmerSkeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted", className)} {...props}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
  )
}

// Topic card skeleton
function TopicCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <ShimmerSkeleton className="h-5 w-3/4" />
          <ShimmerSkeleton className="h-4 w-1/2" />
        </div>
        <ShimmerSkeleton className="h-6 w-16" />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <ShimmerSkeleton className="h-4 w-20" />
          <ShimmerSkeleton className="h-4 w-12" />
        </div>
        <ShimmerSkeleton className="h-2 w-full" />
      </div>
      
      <div className="flex justify-between items-center">
        <ShimmerSkeleton className="h-4 w-24" />
        <ShimmerSkeleton className="h-8 w-24" />
      </div>
    </div>
  )
}

// Stats card skeleton
function StatsCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <ShimmerSkeleton className="h-4 w-1/2" />
      <ShimmerSkeleton className="h-8 w-16" />
      <ShimmerSkeleton className="h-3 w-3/4" />
    </div>
  )
}

// Study plan skeleton
function StudyPlanSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      
      {/* Topic cards */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <TopicCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// Topic list skeleton
function TopicListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <TopicCardSkeleton key={i} />
      ))}
    </div>
  )
}

export { 
  Skeleton, 
  ShimmerSkeleton, 
  TopicCardSkeleton, 
  StatsCardSkeleton, 
  StudyPlanSkeleton, 
  TopicListSkeleton 
}
