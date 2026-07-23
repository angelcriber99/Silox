import { getAssetDetails } from '@/lib/actions/asset-details'
import { AssetClient } from './asset-client'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const ticker = decodeURIComponent(params.ticker)
  const details = await getAssetDetails(ticker)
  
  if (!details) {
    return { title: `Activo no encontrado - Silox` }
  }
  
  return {
    title: `${details.shortName || details.longName || details.symbol} (${details.symbol}) - Silox`,
    description: details.longBusinessSummary?.substring(0, 160) || `Datos y cotización de ${details.symbol}`,
  }
}

export default async function AssetPage({ params }: { params: { ticker: string } }) {
  const ticker = decodeURIComponent(params.ticker)
  const details = await getAssetDetails(ticker)
  
  if (!details) {
    notFound()
  }
  
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <AssetClient details={details} />
    </div>
  )
}
