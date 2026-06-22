import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatPercent,
  formatPnl,
  formatUnits
} from '@/lib/utils/formatters'

describe('Formatters (Empty States & Core Logic)', () => {
  describe('formatCurrency', () => {
    it('handles exactly 0 correctly', () => {
      // "0,00 €" in es-ES locale
      expect(formatCurrency(0)).toMatch(/0,00\s?€/)
    })
    it('handles negative numbers', () => {
      expect(formatCurrency(-10.5)).toMatch(/-10,50\s?€/)
    })
    it('handles null or undefined gracefully if casted (though types require number)', () => {
      expect(formatCurrency(NaN)).toMatch(/NaN/)
    })
  })

  describe('formatPercent', () => {
    it('handles 0 correctly and adds + sign', () => {
      expect(formatPercent(0)).toBe('+0.00%')
    })
    it('handles negative numbers correctly', () => {
      expect(formatPercent(-5.123)).toBe('-5.12%')
    })
    it('handles positive numbers correctly', () => {
      expect(formatPercent(5.123)).toBe('+5.12%')
    })
  })

  describe('formatPnl', () => {
    it('handles exactly 0 correctly', () => {
      expect(formatPnl(0)).toMatch(/\+0,00\s?€/)
    })
    it('adds negative sign for losses', () => {
      expect(formatPnl(-10.5)).toMatch(/-10,50\s?€/)
    })
    it('adds positive sign for gains', () => {
      expect(formatPnl(100.2)).toMatch(/\+100,20\s?€/)
    })
  })

  describe('formatUnits', () => {
    it('formats 0 without decimals', () => {
      expect(formatUnits(0)).toBe('0')
    })
    it('formats exact integers without decimals', () => {
      expect(formatUnits(15)).toBe('15')
    })
    it('formats fractional units with up to 6 decimals', () => {
      expect(formatUnits(15.1234567)).toBe('15,123457')
    })
    it('formats simple fractional units with minimum 2 decimals', () => {
      expect(formatUnits(15.1)).toBe('15,10')
    })
  })
})
