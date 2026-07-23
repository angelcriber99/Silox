"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Loader2, TrendingUp, Building2, Coins, Globe } from "lucide-react"
import { searchAssets, type SearchResultItem } from "@/lib/actions/search"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResultItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()

  const debouncedQuery = useDebounce(query, 300)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  React.useEffect(() => {
    async function performSearch() {
      if (debouncedQuery.length < 2) {
        setResults([])
        return
      }
      
      setIsLoading(true)
      try {
        const data = await searchAssets(debouncedQuery)
        setResults(data)
      } catch (error) {
        console.error(error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    performSearch()
  }, [debouncedQuery])

  const handleSelect = (symbol: string) => {
    setOpen(false)
    setQuery("")
    router.push(`/asset/${symbol}`)
  }

  const getIcon = (quoteType: string | null) => {
    switch (quoteType?.toUpperCase()) {
      case 'CRYPTOCURRENCY':
        return <Coins className="h-4 w-4 text-orange-500" />
      case 'ETF':
        return <Globe className="h-4 w-4 text-blue-500" />
      case 'EQUITY':
        return <Building2 className="h-4 w-4 text-emerald-500" />
      default:
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 sm:py-1.5 text-sm text-muted-foreground bg-background/60 backdrop-blur-md hover:bg-muted/80 rounded-full border border-border/50 shadow-sm transition-all hover:shadow-md"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline-block font-medium">Buscar activo...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background/50 px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden bg-background border-border/50 shadow-2xl">
          <VisuallyHidden>
            <DialogTitle>Buscador de Activos</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
            <input
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Busca por nombre o ticker (ej. AAPL, Bitcoin...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {isLoading && <Loader2 className="animate-spin h-5 w-5 opacity-50" />}
          </div>
          
          <div className="max-h-[300px] overflow-y-auto p-2">
            {query.length > 0 && results.length === 0 && !isLoading && (
              <p className="p-4 text-sm text-center text-muted-foreground">
                No se han encontrado resultados.
              </p>
            )}
            
            {results.length > 0 && (
              <div className="flex flex-col gap-1">
                {results.map((result) => (
                  <button
                    key={result.symbol}
                    onClick={() => handleSelect(result.symbol)}
                    className="flex items-center gap-3 w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors focus:bg-muted/50 focus:outline-none"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                      {getIcon(result.quoteType)}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {result.shortname || result.longname || result.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {result.symbol} • {result.exchange}
                      </span>
                    </div>
                    {result.quoteType && (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {result.quoteType}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {query.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Busca cualquier activo del mercado global
                </p>
                <div className="flex justify-center gap-2 mt-3">
                  <span className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">Acciones</span>
                  <span className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">ETFs</span>
                  <span className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">Cripto</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
