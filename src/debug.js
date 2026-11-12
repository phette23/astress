let enabled = Boolean(
  process.env.DEBUG && !['false', '0'].includes(process.env.DEBUG.toLowerCase())
)

/**
 * Enable or disable debug logging at runtime.
 * @param {boolean} value - Whether debug logging should be enabled
 */
export function setDebug(value) {
  enabled = Boolean(value)
}

/**
 * Log debug output to stderr when debug mode is enabled via DEBUG env or --debug.
 * @param {...unknown} args - Values to log
 */
export function debug(...args) {
  if (enabled) console.error('[debug]', ...args)
}
