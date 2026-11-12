import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/config.js'
import { ASpace } from '../src/aspace.js'
import { main } from '../src/cli.js'

/**
 * Mock global fetch with a route-to-JSON-response map and record all calls.
 * Includes a default `/users/admin/login` response unless overridden.
 * @param {object} t - Node test context
 * @param {Record<string, unknown>} [routes={}] - Map of URL pathname suffixes to response payloads
 * @param {unknown} [fallback=[]] - Default JSON payload when no route matches
 * @returns {Array<{ url: string, options: object }>} Recorded fetch calls
 */
function mockFetch(t, routes = {}, fallback = []) {
  const calls = []
  const allRoutes = {
    '/users/admin/login': { session: 'tok-123' },
    ...routes,
  }

  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    const match = Object.entries(allRoutes).find(([route]) => url.endsWith(route))
    return Response.json(match ? match[1] : fallback)
  })

  return calls
}

test('loads config from file and resolves aspace client settings', () => {
  const config = loadConfig('example.config.json')
  assert.strictEqual(config.discovery.resourcesFile, '.astress-resources.json')
  assert.strictEqual(config.run.settings.concurrency, 10)

  const aspace = new ASpace(config.aspace)
  assert.strictEqual(aspace.apiUrl, 'http://localhost:8089')
  assert.strictEqual(aspace.puiUrl, 'http://localhost:8081')
  assert.strictEqual(aspace.username, 'admin')
  assert.strictEqual(aspace.password, 'admin')
  assert.strictEqual(aspace.timeout, 30000)
})

test('handles anonymous PUI, anonymous API, and authenticated API requests', async (t) => {
  const calls = mockFetch(t, {}, { ok: true })

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

test('discover subcommand handles non-existent and existent resources files', async (t) => {
  mockFetch(t)

  const dir = mkdtempSync(join(tmpdir(), 'astress-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const resourcesFile = join(dir, '.astress-resources.json')
  const configFile = join(dir, 'config.json')
  writeFileSync(configFile, JSON.stringify({
    aspace: { apiUrl: 'http://localhost:8089', username: 'admin', password: 'admin' },
    discovery: { resourcesFile },
  }))

  // Non-existent resources file
  assert.strictEqual(existsSync(resourcesFile), false)
  await main(['discover', '-f', configFile])
  assert.strictEqual(existsSync(resourcesFile), true)

  // Existent resources file is overwritten with fresh discovery output
  writeFileSync(resourcesFile, JSON.stringify({ stale: true }))
  await main(['discover', '-f', configFile])
  const secondManifest = JSON.parse(readFileSync(resourcesFile, 'utf8'))
  assert.strictEqual(secondManifest.stale, undefined)
  assert.deepStrictEqual(secondManifest.repositories, [])
})

test('discover harvests published repositories and samples repo-scoped resources across repos', async (t) => {
  mockFetch(t, {
    '/repositories': [
      { uri: '/repositories/2', publish: true },
      { uri: '/repositories/3', publish: false },
      { uri: '/repositories/4', publish: true },
    ],
    '/repositories/2/resources?all_ids=true': [1, 2, 3],
    '/repositories/4/resources?all_ids=true': [10, 20],
  })

  const dir = mkdtempSync(join(tmpdir(), 'astress-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const resourcesFile = join(dir, '.astress-resources.json')
  const configFile = join(dir, 'config.json')
  writeFileSync(configFile, JSON.stringify({
    aspace: { apiUrl: 'http://localhost:8089', username: 'admin', password: 'admin' },
    discovery: { resourcesFile, maxSamplePerType: 3 },
  }))

  await main(['discover', '-f', configFile])
  const manifest = JSON.parse(readFileSync(resourcesFile, 'utf8'))
  assert.deepStrictEqual(manifest.repositories, ['/repositories/2', '/repositories/4'])
  assert.deepStrictEqual(manifest.resources.resources, [
    '/repositories/2/resources/1',
    '/repositories/4/resources/10',
    '/repositories/2/resources/2',
  ])
})

test('discover harvests and caps global resources up to maxSamplePerType', async (t) => {
  mockFetch(t, {
    '/subjects?all_ids=true': [10, 20, 30, 40],
    '/agents/people?all_ids=true': [1, 2],
  })

  const dir = mkdtempSync(join(tmpdir(), 'astress-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const resourcesFile = join(dir, '.astress-resources.json')
  const configFile = join(dir, 'config.json')
  writeFileSync(configFile, JSON.stringify({
    aspace: { apiUrl: 'http://localhost:8089', username: 'admin', password: 'admin' },
    discovery: { resourcesFile, maxSamplePerType: 3 },
  }))

  await main(['discover', '-f', configFile])
  const manifest = JSON.parse(readFileSync(resourcesFile, 'utf8'))
  assert.deepStrictEqual(manifest.resources.subjects, [
    '/subjects/10',
    '/subjects/20',
    '/subjects/30',
  ])
  assert.deepStrictEqual(manifest.resources['agents/people'], [
    '/agents/people/1',
    '/agents/people/2',
  ])
  assert.deepStrictEqual(manifest.resources['agents/corporate_entities'], [])
  assert.deepStrictEqual(manifest.resources['agents/families'], [])
})

test('cli prints help output with -h and --help', async (t) => {
  const lines = []
  t.mock.method(console, 'log', (msg) => lines.push(msg))

  await main(['--help'])
  const output = lines.join('\n')
  assert.match(output, /Usage: astress/)
  assert.match(output, /-f, --config/)
  assert.match(output, /--debug/)
  assert.match(output, /-h, --help/)
})
