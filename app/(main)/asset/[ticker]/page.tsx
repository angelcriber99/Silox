import { getAssetDetails } from '@/lib/actions/asset-details'
import { AssetClient } from './asset-client'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

export async function generateMetadata(props: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const params = await props.params;
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

export default async function AssetPage(props: { params: Promise<{ ticker: string }> }) {
  const params = await props.params;
  const ticker = decodeURIComponent(params.ticker)
  const details = await getAssetDetails(ticker)
  
  if (!details) {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">No se pudo cargar la información</h1>
        <p className="text-muted-foreground">No hemos podido obtener datos para el ticker: {ticker}</p>
      </div>
    )
  }
  
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <AssetClient details={details} />
    </div>
  )
}
