#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { ASpace } from './aspace.js'

const { values } = parseArgs({
  options: {
    config: { type: 'string', short: 'f', default: 'config.json' },
  },
  allowPositionals: true,
})

// TODO only loads config for now
const AS = new ASpace(values.config)
console.log(AS)
