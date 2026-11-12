import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export const GLOBAL_RESOURCES = [
  'subjects',
  'agents/people',
  'agents/corporate_entities',
  'agents/families',
]

export const REPO_RESOURCES = [
  'resources',
  'archival_objects',
  'digital_objects',
  'accessions',
  'classifications',
  'top_containers',
]

/**
 * Fetch all published repository URIs from the ArchivesSpace API.
 * @param {ASpace} aspace - Configured ASpace client
 * @returns {Promise<string[]>} List of published repository URIs (e.g. ['/repositories/2'])
 */
export async function discoverRepositories(aspace) {
  const res = await aspace.api('/repositories')
  if (!res.ok) throw new Error(`Failed to fetch repositories: ${res.status}`)
  const repos = await res.json()
  // Only include published repositories so PUI stress tests hit public routes that exist
  return repos.filter((r) => r.publish).map((r) => r.uri)
}

/**
 * Discover URIs for a global (non-repository-scoped) resource type.
 * @param {ASpace} _aspace - Configured ASpace client
 * @param {string} _type - API endpoint path (e.g. 'subjects' or 'agents/people')
 * @param {number} _maxSample - Maximum number of URIs to sample for this type
 * @returns {Promise<string[]>} Sampled resource URIs
 */
export async function discoverGlobal(_aspace, _type, _maxSample) {
  // shortcut: returns empty list until global resource harvesting is implemented
  return []
}

/**
 * Discover URIs for a repository-scoped resource type across all published repositories.
 * Takes all repositories at once so sampling up to maxSample is distributed across repos
 * rather than letting the first repository exhaust the quota.
 * @param {ASpace} _aspace - Configured ASpace client
 * @param {string[]} _repositories - Published repository URIs
 * @param {string} _type - Repo-scoped endpoint name (e.g. 'resources', 'archival_objects')
 * @param {number} _maxSample - Maximum total URIs to sample across all repositories
 * @returns {Promise<string[]>} Sampled resource URIs
 */
export async function discoverRepoScoped(_aspace, _repositories, _type, _maxSample) {
  // shortcut: returns empty list until repo-scoped resource harvesting is implemented
  return []
}

/**
 * Run discovery against an ArchivesSpace instance and persist the manifest to disk.
 * @param {ASpace} aspace - Configured ASpace client
 * @param {object} [options] - Discovery configuration
 * @param {string} [options.cacheFile='.astress-cache.json'] - Path to read/write cache manifest
 * @param {number} [options.maxSamplePerType=100] - Max URIs to sample per resource type
 * @returns {Promise<object>} Updated discovery cache object
 */
export async function discover(aspace, { cacheFile = '.astress-cache.json', maxSamplePerType = 100 } = {}) {
  // Preserve any existing cache keys before overwriting discovered sections
  const existing = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, 'utf8'))
    : {}

  // Reuse cached repositories if already present, otherwise harvest from the API
  const repositories = existing.repositories ?? await discoverRepositories(aspace)

  const resources = {}
  for (const type of GLOBAL_RESOURCES) {
    resources[type] = await discoverGlobal(aspace, type, maxSamplePerType)
  }
  for (const type of REPO_RESOURCES) {
    resources[type] = await discoverRepoScoped(aspace, repositories, type, maxSamplePerType)
  }

  const cache = {
    ...existing,
    repositories,
    resources,
  }

  writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
  return cache
}
