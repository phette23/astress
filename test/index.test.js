import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/config.js'
import { ASpace } from '../src/aspace.js'
import { main } from '../src/cli.js'

test('loads config from file and resolves aspace client settings', () => {
  const config = loadConfig('example.config.json')
  assert.strictEqual(config.discovery.cacheFile, '.astress-cache.json')
  assert.strictEqual(config.run.settings.concurrency, 10)

  const aspace = new ASpace(config.aspace)
  assert.strictEqual(aspace.apiUrl, 'http://localhost:8089')
  assert.strictEqual(aspace.puiUrl, 'http://localhost:8081')
  assert.strictEqual(aspace.username, 'admin')
  assert.strictEqual(aspace.password, 'admin')
  assert.strictEqual(aspace.timeout, 30000)
})

test('handles anonymous PUI, anonymous API, and authenticated API requests', async (t) => {
  const calls = []
  // all HTTP requests use fetch as base
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/users/admin/login')) {
      return Response.json({ session: 'tok-123' })
    }
    return Response.json({ ok: true })
  })

  const config = loadConfig('example.config.json')
  const aspace = new ASpace(config.aspace)

  await aspace.pui('/repositories')
  assert.strictEqual(calls[0].url, 'http://localhost:8081/repositories')
  assert.strictEqual(calls[0].options.headers, undefined)

  await aspace.api('/version', { auth: false })
  assert.strictEqual(calls[1].url, 'http://localhost:8089/version')
  assert.deepStrictEqual(calls[1].options.headers, {})

  await aspace.api('/repositories')
  assert.strictEqual(calls[2].url, 'http://localhost:8089/users/admin/login')
  assert.strictEqual(calls[2].options.method, 'POST')
  assert.strictEqual(calls[3].url, 'http://localhost:8089/repositories')
  assert.strictEqual(calls[3].options.headers['X-ArchivesSpace-Session'], 'tok-123')

  // If we already have a session, then admin/login is not called
  await aspace.api('/repositories')
  assert.notStrictEqual(calls[4].url, 'http://localhost:8089/users/admin/login')
  assert.notStrictEqual(calls[4].options.method, 'POST')
  assert.strictEqual(calls[4].url, 'http://localhost:8089/repositories')
  assert.strictEqual(calls[4].options.headers['X-ArchivesSpace-Session'], 'tok-123')
  assert.strictEqual(calls.length, 5)
})

test('discover subcommand handles non-existent and existent cache files', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/users/admin/login')) {
      return Response.json({ session: 'tok-123' })
    }
    return Response.json([])
  })

  const dir = mkdtempSync(join(tmpdir(), 'astress-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const cacheFile = join(dir, '.astress-cache.json')
  const configFile = join(dir, 'config.json')
  writeFileSync(configFile, JSON.stringify({
    aspace: { apiUrl: 'http://localhost:8089', username: 'admin', password: 'admin' },
    discovery: { cacheFile },
  }))

  // Non-existent cache file
  assert.strictEqual(existsSync(cacheFile), false)
  await main(['discover', '-f', configFile])
  assert.strictEqual(existsSync(cacheFile), true)

  // Existent cache file
  writeFileSync(cacheFile, JSON.stringify({ custom: true }))
  await main(['discover', '-f', configFile])
  const secondCache = JSON.parse(readFileSync(cacheFile, 'utf8'))
  assert.strictEqual(secondCache.custom, true)
})

test('discover harvests published repositories and initializes resource buckets', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/users/admin/login')) {
      return Response.json({ session: 'tok-123' })
    }
    if (url.endsWith('/repositories')) {
      return Response.json([
        { uri: '/repositories/2', publish: true },
        { uri: '/repositories/3', publish: false },
      ])
    }
    return Response.json([])
  })

  const dir = mkdtempSync(join(tmpdir(), 'astress-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const cacheFile = join(dir, '.astress-cache.json')
  const configFile = join(dir, 'config.json')
  writeFileSync(configFile, JSON.stringify({
    aspace: { apiUrl: 'http://localhost:8089', username: 'admin', password: 'admin' },
    discovery: { cacheFile },
  }))

  const cache = await main(['discover', '-f', configFile])
  assert.deepStrictEqual(cache.repositories, ['/repositories/2'])
  assert.ok('subjects' in cache.resources)
  assert.ok('resources' in cache.resources)
})
