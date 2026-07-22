import 'server-only'

import { getCache } from '@vercel/functions'

const localFallback = new Map<string, { value: unknown; expiresAt: number }>()

export async function getMarketCacheValue<T>(key: string): Promise<T | undefined> {
  try {
    const value = await getCache({ namespace: 'silox-market-v1' }).get(key)
    if (value !== undefined) return value as T
  } catch {
    // Runtime Cache is only guaranteed inside Vercel Functions.
  }

  const local = localFallback.get(key)
  if (!local || local.expiresAt <= Date.now()) {
    localFallback.delete(key)
    return undefined
  }
  return local.value as T
}

export async function setMarketCacheValue<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  tags: string[] = ['market-prices'],
): Promise<void> {
  const ttl = Math.max(1, Math.floor(ttlSeconds))
  localFallback.set(key, { value, expiresAt: Date.now() + ttl * 1_000 })
  try {
    await getCache({ namespace: 'silox-market-v1' }).set(key, value, {
      ttl,
      tags,
      name: 'silox-market-data',
    })
  } catch {
    // Local/dev and non-Vercel deployments retain the in-process fallback.
  }

  if (localFallback.size > 500) {
    const now = Date.now()
    for (const [cacheKey, entry] of localFallback) {
      if (entry.expiresAt <= now) localFallback.delete(cacheKey)
    }
  }
}
