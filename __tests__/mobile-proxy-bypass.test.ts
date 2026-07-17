import { describe, expect, it } from 'vitest'
import { config } from '@/proxy'

describe('mobile API proxy boundary', () => {
  it('lets the versioned mobile API validate Bearer tokens in its route handlers', () => {
    expect(config.matcher[0]).toContain('api/mobile')
    expect(config.matcher[0]).toContain('api/widget')
  })
})
