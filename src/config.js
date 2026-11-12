import { readFileSync } from 'node:fs'

// Load configuration from file
export function loadConfig(config = 'config.json') {
  const raw = typeof config === 'string'
    ? JSON.parse(readFileSync(config, 'utf8'))
    : config

  return {
    aspace: {
      timeoutMs: 30000,
      ...raw.aspace,
    },
    discovery: {
      cacheFile: '.astress-cache.json',
      ...raw.discovery,
    },
    run: {
      settings: { ...raw.run?.settings },
      workloads: { ...raw.run?.workloads },
    },
  }
}
