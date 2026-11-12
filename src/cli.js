#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { loadConfig } from './config.js'
import { ASpace } from './aspace.js'
import { discover } from './discover.js'

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      config: { type: 'string', short: 'f', default: 'config.json' },
    },
    allowPositionals: true,
  })

  const config = loadConfig(values.config)
  const AS = new ASpace(config.aspace)
  const [command] = positionals

  if (command === 'discover') {
    return discover(AS, config.discovery)
  }
}

if (import.meta.main) {
  await main()
}
