import { describe, expect, it } from 'vitest'
import {
  CASH_ASSET_DEFAULTS,
  displayAssetType,
  isInvestablePortfolioAsset,
  toDatabaseAssetPayload,
} from '@/lib/domain/assets/normalization'
import { getErrorMessage } from '@/lib/utils/errors'

describe('asset normalization', () => {
  it('maps persisted metal assets back to the UI type', () => {
    expect(displayAssetType({ ticker: 'GC=F', tipo: 'Crypto', sector: 'Metales' })).toEqual({
      ticker: 'GC=F',
      tipo: 'Metal',
      sector: 'Metales',
    })
  })

  it('maps the UI metal type to the supported database representation', () => {
    expect(toDatabaseAssetPayload({ tipo: 'Metal' })).toEqual({
      tipo: 'Crypto',
      sector: 'Metales',
      geografia: 'Global',
    })
  })

  it('keeps cash aligned with the hardened database constraints', () => {
    expect(CASH_ASSET_DEFAULTS).toMatchObject({
      ticker: 'CASH',
      tipo: 'Liquidez',
      estrategia: 'Liquidez',
      moneda: 'EUR',
    })
  })

  it('keeps cash and money-market bookkeeping out of the visible portfolio', () => {
    expect(isInvestablePortfolioAsset({ ticker: 'CASH', tipo: 'Fondo Monetario' })).toBe(false)
    expect(isInvestablePortfolioAsset({ ticker: 'CASH_USD', tipo: 'Fondo Monetario' })).toBe(false)
    expect(isInvestablePortfolioAsset({ ticker: 'REVOLUT', tipo: 'Fondo Monetario' })).toBe(false)
    expect(isInvestablePortfolioAsset({ ticker: 'ASTS', tipo: 'Acción' })).toBe(true)
  })
})

describe('error messages', () => {
  it('uses Error messages and a safe fallback for unknown values', () => {
    expect(getErrorMessage(new Error('fallo'), 'fallback')).toBe('fallo')
    expect(getErrorMessage({ message: 'untrusted' }, 'fallback')).toBe('fallback')
  })
})

