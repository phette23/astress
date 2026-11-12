import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ASpace } from '../src/aspace.js'

test('loads config from file and resolves target settings', () => {
  const aspace = new ASpace('example.config.json')
  assert.strictEqual(aspace.apiUrl, 'http://localhost:8089')
  assert.strictEqual(aspace.puiUrl, 'http://localhost:8081')
  assert.strictEqual(aspace.username, 'admin')
  assert.strictEqual(aspace.password, 'admin')
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

  const aspace = new ASpace('example.config.json')

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
