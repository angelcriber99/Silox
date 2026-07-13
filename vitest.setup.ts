import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock matchMedia for recharts or responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = []
  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
  unobserve() {}
}
window.IntersectionObserver = MockIntersectionObserver

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/supabase/client', () => {
  function queryBuilder() {
    const result = Promise.resolve({ data: [], error: null })
    const builder: Record<string, unknown> = {}
    for (const method of [
      'select', 'insert', 'update', 'delete', 'eq', 'is', 'like',
      'order', 'limit', 'single', 'maybeSingle', 'upsert',
    ]) {
      builder[method] = vi.fn(() => builder)
    }
    builder.then = result.then.bind(result)
    builder.catch = result.catch.bind(result)
    builder.finally = result.finally.bind(result)
    return builder
  }

  return {
    createClient: () => ({
      from: vi.fn(() => queryBuilder()),
      channel: vi.fn(() => {
        const channel = {
          on: vi.fn(() => channel),
          subscribe: vi.fn(() => channel),
        }
        return channel
      }),
      removeChannel: vi.fn(),
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    }),
  }
})
