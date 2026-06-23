import { useQuery } from "@tanstack/react-query"
import { Newspaper, ExternalLink, Loader2 } from "lucide-react"

interface AssetNewsProps {
  ticker: string
}

interface NewsItem {
  uuid: string
  title: string
  publisher: string
  link: string
  providerPublishTime: number
  type: string
}

async function fetchNews(ticker: string): Promise<NewsItem[]> {
  const res = await fetch(`/api/news?ticker=${encodeURIComponent(ticker)}`)
  if (!res.ok) throw new Error("Error fetching news")
  const data = await res.json()
  return data.news
}

export function AssetNews({ ticker }: AssetNewsProps) {
  const { data: news, isLoading, error } = useQuery({
    queryKey: ['news', ticker],
    queryFn: () => fetchNews(ticker),
    staleTime: 1000 * 60 * 15, // 15 mins
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
        <Loader2 className="h-6 w-6 animate-spin mb-2" />
        <p className="text-sm">Buscando noticias relevantes...</p>
      </div>
    )
  }

  if (error || !news || news.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
        <Newspaper className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">No hay noticias recientes para este activo.</p>
      </div>
    )
  }

  // Filter out any news that don't have a valid link
  const validNews = news.filter(n => n.link && n.title)

  if (validNews.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-6 border-b border-border flex items-center gap-2">
        <div className="bg-blue-500/10 p-2 rounded-lg">
          <Newspaper className="h-5 w-5 text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Noticias del Mercado</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
        {validNews.slice(0, 6).map((item) => {
          const date = new Date(item.providerPublishTime * 1000).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })

          return (
            <a
              key={item.uuid}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between p-4 rounded-xl border border-border bg-background hover:bg-muted transition-colors"
            >
              <div>
                <h4 className="text-sm font-semibold text-foreground/90 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                  {item.title}
                </h4>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/60">{item.publisher}</span>
                  <span>•</span>
                  <span>{date}</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-blue-400 transition-colors" />
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
