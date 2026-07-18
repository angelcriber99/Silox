const METAL_TICKERS = new Set([
  'XAGUSD=X', 'XAGEUR=X', 'XAUUSD=X', 'XAUEUR=X',
  'XPDUSD=X', 'XPDEUR=X', 'XPTUSD=X', 'XPTEUR=X',
  'SI=F', 'GC=F', 'PA=F', 'PL=F',
])

export function displayAssetType<
  T extends { tipo: string; sector?: string | null; ticker?: string | null },
>(asset: T): T {
  const isMetal = asset.sector === 'Metales' || (asset.ticker != null && METAL_TICKERS.has(asset.ticker))
  return isMetal ? ({ ...asset, tipo: 'Metal' } as T) : asset
}

export function toDatabaseAssetPayload<
  T extends { tipo?: string; sector?: string; geografia?: string },
>(asset: T): T {
  if (asset.tipo !== 'Metal') return asset
  return {
    ...asset,
    tipo: 'Crypto',
    sector: asset.sector || 'Metales',
    geografia: asset.geografia || 'Global',
  } as T
}

export function isInvestablePortfolioAsset<
  T extends { ticker?: string | null; tipo: string },
>(asset: T): boolean {
  const ticker = asset.ticker?.toUpperCase() ?? ''
  return !ticker.startsWith('CASH')
    && ticker !== 'REVOLUT'
    && asset.tipo !== 'Fondo Monetario'
    && asset.tipo !== 'Liquidez'
}

export const CASH_ASSET_DEFAULTS = {
  ticker: 'CASH',
  nombre: 'Efectivo',
  tipo: 'Liquidez',
  estrategia: 'Liquidez',
  moneda: 'EUR',
} as const

