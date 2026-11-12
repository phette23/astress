import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export async function discover(_aspace, { cacheFile = '.astress-cache.json' } = {}) {
  const cache = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, 'utf8'))
    : {}
  // shortcut: only initializes/reads cache file for now, add API harvesting next
  writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
  return cache
}
