import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { config } from '@/proxy'

describe('mobile API proxy boundary', () => {
  it('lets the versioned mobile API validate Bearer tokens in its route handlers', () => {
    const middleware = readFileSync('lib/supabase/middleware.ts', 'utf8')

    expect(config.matcher[0]).not.toContain('api/mobile')
    expect(middleware).toContain("startsWith('/api/mobile')")
    expect(middleware).toContain("startsWith('/api/widget')")
  })
})
