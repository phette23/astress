import { readFileSync } from 'node:fs'

/**
 * Load configuration from a JSON file path (or object) and apply section defaults.
 * @param {string|object} [config='config.json'] - Path to config file or raw config object
 * @returns {{ aspace: object, discovery: object, run: { settings: object, workloads: object } }}
 */
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
      resourcesFile: '.astress-resources.json',
      ...raw.discovery,
    },
    run: {
      settings: { ...raw.run?.settings },
      workloads: { ...raw.run?.workloads },
    },
  }
}
