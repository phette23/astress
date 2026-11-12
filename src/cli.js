#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { loadConfig } from './config.js'
import { ASpace } from './aspace.js'
import { discover } from './discover.js'
import { run } from './run.js'
import { setDebug } from './debug.js'

const options = {
  config: { type: 'string', short: 'f', default: 'config.json', description: 'Path to config file' },
  debug: { type: 'boolean', default: false, description: 'Enable debug logging' },
  help: { type: 'boolean', short: 'h', default: false, description: 'Show this help' },
}

/**
 * Parse CLI arguments and dispatch the requested subcommand.
 * @param {string[]} [args=process.argv.slice(2)] - CLI arguments
 * @returns {Promise<unknown>} Result of the executed subcommand
 */
export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const [command] = positionals

  if (values.help || !command) {
    console.log('Usage: astress <discover|run> [options]\n')
    for (const [name, opt] of Object.entries(options)) {
      const flags = opt.short ? `-${opt.short}, --${name}` : `    --${name}`
      console.log(`  ${flags.padEnd(16)} ${opt.description}`)
    }
    return
  }

  if (values.debug) setDebug(true)

  const config = loadConfig(values.config)
  const AS = new ASpace(config.aspace)

  if (command === 'discover') {
    return discover(AS, config.discovery)
  }

  if (command === 'run') {
    return run(AS, config.run)
  }
}

if (import.meta.main) {
  await main()
}
