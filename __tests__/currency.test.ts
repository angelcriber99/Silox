import { describe, it, expect } from 'vitest'
import {
  convertToEur,
  convertSeriesToEur,
  normalizeYahooCurrency,
  normalizeYahooPrice,
} from '@/lib/utils/currency'

describe('Currency Logic (Empty & Edge cases)', () => {
  describe('convertToEur', () => {
    const rates = { USD: 1.1, GBP: 0.85 }

    it('returns amount directly if currency is EUR', () => {
      expect(convertToEur(100, 'EUR', rates)).toBe(100)
    })
    it('returns amount directly if rate is missing', () => {
      expect(convertToEur(100, 'CAD', rates)).toBe(100)
    })
    it('returns amount directly if rate is 0', () => {
      expect(convertToEur(100, 'USD', { USD: 0 })).toBe(100)
    })
    it('converts correctly when rate exists', () => {
      expect(convertToEur(110, 'USD', rates)).toBeCloseTo(100)
    })
    it('handles 0 amount', () => {
      expect(convertToEur(0, 'USD', rates)).toBe(0)
    })
  })

  describe('convertSeriesToEur', () => {
    const rates = { USD: 1.1 }

    it('converts an array of values correctly', () => {
      const result = convertSeriesToEur([0, 110, 220], 'USD', rates)
      expect(result[0]).toBeCloseTo(0)
      expect(result[1]).toBeCloseTo(100)
      expect(result[2]).toBeCloseTo(200)
    })
    it('handles empty arrays', () => {
      expect(convertSeriesToEur([], 'USD', rates)).toEqual([])
    })
  })

  describe('normalizeYahooCurrency', () => {
    it('defaults to USD if undefined', () => {
      expect(normalizeYahooCurrency(undefined)).toBe('USD')
    })
    it('normalizes GBX to GBP', () => {
      expect(normalizeYahooCurrency('GBX')).toBe('GBP')
      expect(normalizeYahooCurrency('gbp')).toBe('GBP')
    })
    it('capitalizes currencies', () => {
      expect(normalizeYahooCurrency('eur')).toBe('EUR')
    })
  })

  describe('normalizeYahooPrice', () => {
    it('convierte peniques británicos a libras sin alterar otras monedas', () => {
      expect(normalizeYahooPrice(725, 'GBX')).toBe(7.25)
      expect(normalizeYahooPrice(725, 'GBp')).toBe(7.25)
      expect(normalizeYahooPrice(725, 'GBP')).toBe(725)
      expect(normalizeYahooPrice(25, 'USD')).toBe(25)
    })
  })
})
