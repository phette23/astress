export class ASpace {
  /**
   * @param {Object} [config={}] - Configuration options
   */
  constructor(config = {}) {
    const conf = config.aspace ?? config

    this.apiUrl = conf.apiUrl?.replace(/\/$/, '')
    this.puiUrl = conf.puiUrl?.replace(/\/$/, '')
    this.username = conf.username
    this.password = (conf.passwordEnv && process.env[conf.passwordEnv]) || conf.password
    // ? should timeout have a minimum? Setting it to "0" would make things unusable
    this.timeout = conf.timeoutMs ?? 30000
    this.session = null
  }

  /**
   * Password login to ASpace API
   * https://docs.archivesspace.org/api/#authentication
   * Updates this.session to point to the current ASpace session token.
   * @returns {Promise<string>} the session token
   */
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

  /**
   * Authenticated request to the API.
   * @param {string} path - URL path to the resource
   * @param {boolean} [options.auth=true] - Whether to authenticate the API request
   * @param {HeadersInit} [options.headers] - HTTP headers
   * @param {RequestInit} [options={}] - Additional HTTP options to pass onto Fetch
   * @returns {Promise<Response>}
   */
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

  /**
   * Unauthenticated public UI requests, basically just a wrapper around fetch.
   * @param {string} path - URL Path to the resource
   * @param {object} options={} - HTTP options passed onto fetch
   * @returns {Promise<Response>}
   */
  async pui(path, options = {}) {
    return this.request(`${this.puiUrl}${path}`, options)
  }

  /**
   * Base request layer, wrapper around fetch with a timeout.
   * @param {string} url
   * @param {object} options={} - HTTP options passed onto fetch
   * @returns {Promise<Response>}
   */
  async request(url, options = {}) {
    return fetch(url, {
      signal: AbortSignal.timeout(this.timeout),
      ...options,
    })
  }
}
