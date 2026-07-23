"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Search, Loader2, TrendingUp, Building2, Coins, Globe } from "lucide-react"
import { searchAssets, type SearchResultItem } from "@/lib/actions/search"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

import { usePositions } from "@/lib/hooks/use-portfolio"

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResultItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()
  
  const { data: positions } = usePositions()

  const debouncedQuery = useDebounce(query, 300)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    const openSearch = () => setOpen(true)

    document.addEventListener("keydown", down)
    window.addEventListener("open-global-search", openSearch)
    
    return () => {
      document.removeEventListener("keydown", down)
      window.removeEventListener("open-global-search", openSearch)
    }
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
    
    const ownedAsset = positions?.find(p => p.ticker === symbol)
    if (ownedAsset) {
      router.push(`/activo/${ownedAsset.activo_id}`)
    } else {
      router.push(`/asset/${symbol}`)
    }
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[650px] p-0 gap-0 overflow-hidden bg-background/70 backdrop-blur-2xl shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)] border border-white/10 rounded-2xl">
        <VisuallyHidden>
          <DialogTitle>Buscador de Activos</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-center px-4 py-4 border-b border-white/5 relative">
          <Search className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            className="flex flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/60 text-foreground"
            placeholder="Busca por empresa, ticker o ETF (ej. Apple, SPY, Bitcoin...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {isLoading ? (
            <Loader2 className="animate-spin h-5 w-5 text-muted-foreground absolute right-4" />
          ) : (
            <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-white/10 bg-white/5 px-2 font-mono text-[10px] font-medium text-muted-foreground absolute right-4">
              <span className="text-xs">Esc</span>
            </kbd>
          )}
        </div>
        
        <div className="max-h-[350px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {query.length > 0 && results.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Search className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-foreground font-medium">Sin resultados</p>
              <p className="text-xs text-muted-foreground mt-1">No hemos encontrado activos que coincidan con tu búsqueda.</p>
            </div>
          )}
          
          {results.length > 0 && (
            <div className="flex flex-col gap-1 p-1">
              <span className="text-xs font-semibold text-muted-foreground/50 px-2 py-1.5 uppercase tracking-wider">Activos del mercado</span>
              {results.map((result) => (
                <button
                  key={result.symbol}
                  onClick={() => handleSelect(result.symbol)}
                  className="group flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 focus:bg-white/10 focus:outline-none"
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white/5 border border-white/5 shadow-inner group-hover:scale-105 transition-transform duration-200">
                    {getIcon(result.quoteType)}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0 justify-center">
                    <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {result.shortname || result.longname || result.symbol}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono bg-white/5 px-1.5 py-0.5 rounded-md">
                        {result.symbol}
                      </span>
                      {result.exchange && (
                        <span className="text-[10px] text-muted-foreground/70 truncate">
                          • {result.exchange}
                        </span>
                      )}
                    </div>
                  </div>
                  {result.quoteType && (
                    <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                      {result.quoteType}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {query.length === 0 && (
            <div className="p-8 text-center flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border border-white/5 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(0,0,0,0.2)]">
                <Globe className="h-6 w-6 text-primary/70" />
              </div>
              <p className="text-sm text-foreground font-medium mb-1">
                Explora el mercado global
              </p>
              <p className="text-xs text-muted-foreground max-w-[250px] leading-relaxed">
                Busca cualquier empresa, ETF, índice o criptomoneda en tiempo real.
              </p>
              
              <div className="flex flex-wrap justify-center gap-2 mt-6 w-full max-w-[300px]">
                <div className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-muted-foreground shadow-sm">
                  <Building2 className="h-3 w-3 text-emerald-500/70" /> Acciones
                </div>
                <div className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-muted-foreground shadow-sm">
                  <Globe className="h-3 w-3 text-blue-500/70" /> ETFs
                </div>
                <div className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-muted-foreground shadow-sm">
                  <Coins className="h-3 w-3 text-orange-500/70" /> Cripto
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
