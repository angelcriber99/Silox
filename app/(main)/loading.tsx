import { Skeleton } from '@/components/ui/skeleton'

export default function MainLoading() {
  return (
    <div aria-label="Cargando cartera" aria-busy="true" className="min-h-full bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="flex items-end justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-52" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <div className="space-y-5">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        </div>

        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}
