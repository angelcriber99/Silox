import { Skeleton } from "@/components/ui/skeleton"

export default function MainLoading() {
  return (
    <div aria-label="Cargando cartera" aria-busy="true" className="h-[calc(100dvh-112px)] overflow-hidden bg-background p-3 md:h-[calc(100dvh-96px)] md:p-5">
      <div className="mx-auto grid h-full w-full max-w-[1720px] grid-rows-[56px_92px_minmax(0,1fr)] gap-3">
        <Skeleton className="rounded-2xl" />
        <div className="grid grid-cols-3 gap-2 md:grid-cols-5 md:gap-3">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className={index > 2 ? "hidden rounded-2xl md:block" : "rounded-2xl"} />)}
        </div>
        <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-[1.7fr_1fr]">
          <Skeleton className="rounded-2xl" />
          <div className="hidden min-h-0 grid-rows-3 gap-3 md:grid"><Skeleton className="rounded-2xl" /><Skeleton className="rounded-2xl" /><Skeleton className="rounded-2xl" /></div>
        </div>
      </div>
    </div>
  )
}
