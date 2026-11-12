import { readFileSync } from 'node:fs'

export class ASpace {
  constructor(config = 'config.json') {
    const conf = typeof config === 'string'
      ? JSON.parse(readFileSync(config, 'utf8'))
      : config

    this.config = conf
    this.apiUrl = conf.target?.apiUrl?.replace(/\/$/, '')
    this.puiUrl = conf.target?.puiUrl?.replace(/\/$/, '')
    this.username = conf.target?.username
    this.password = (conf.target?.passwordEnv && process.env[conf.target?.passwordEnv] || conf.target?.password)
    // ? should timeout have a minimum? Setting it to "0" would make things unusable
    this.timeout = conf.execution?.timeoutMs ?? 30000
    this.session = null
  }

  // password login to ASpace API
  // https://docs.archivesspace.org/api/#authentication
  async login() {
    const res = await this.request(`${this.apiUrl}/users/${encodeURIComponent(this.username)}/login`, {
      method: 'POST',
      body: new URLSearchParams({ password: this.password }),
    })
    if (!res.ok) throw new Error(`Login failed: ${res.status}`)
    const data = await res.json()
    this.session = data.session
    return this.session
  }

  // Authenticated request to API
  async api(path, { auth = true, headers, ...options } = {}) {
    if (auth && !this.session) await this.login() // login if we're not authenticated
    // TODO (low priority) reauthenticate if session has expired
    return this.request(`${this.apiUrl}${path}`, {
      ...options,
      headers: {
        ...(auth && this.session ? { 'X-ArchivesSpace-Session': this.session } : {}),
        ...headers,
      },
    })
  }

  // Unauthenticated public UI requests, basically just a wrapper around fetch
  async pui(path, options = {}) {
    return this.request(`${this.puiUrl}${path}`, options)
  }

  async request(url, options = {}) {
    return fetch(url, {
      signal: AbortSignal.timeout(this.timeout),
      ...options,
    })
  }
}
