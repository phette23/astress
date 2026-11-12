import { writeFileSync } from 'node:fs'

export const GLOBAL_RESOURCES = [
  'subjects',
  'agents/people',
  'agents/corporate_entities',
  'agents/families',
]

// Start with top-level 'resources' (collections); child archival_objects and other
// repo-scoped types will be added as their endpoints are wired up
export const REPO_RESOURCES = [
  'resources',
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
 * Fetches ID lists from each repository and interleaves them round-robin up to maxSample
 * so the first repository cannot exhaust the sample quota.
 * @param {ASpace} aspace - Configured ASpace client
 * @param {string[]} repositories - Published repository URIs
 * @param {string} type - Repo-scoped endpoint name (e.g. 'resources')
 * @param {number} maxSample - Maximum total URIs to sample across all repositories
 * @returns {Promise<string[]>} Sampled resource URIs
 */
export async function discoverRepoScoped(aspace, repositories, type, maxSample) {
  const listsByRepo = await Promise.all(
    repositories.map(async (repoUri) => {
      // ?all_ids=true returns a flat array of numeric IDs in one request without pagination
      const res = await aspace.api(`${repoUri}/${type}?all_ids=true`)
      if (!res.ok) throw new Error(`Failed to fetch ${repoUri}/${type}: ${res.status}`)
      const ids = await res.json()
      return ids.map((id) => `${repoUri}/${type}/${id}`)
    })
  )

  // Round-robin across repositories so every published repo is represented in the sample
  const sampled = []
  for (let i = 0; sampled.length < maxSample; i++) {
    let added = false
    for (const uris of listsByRepo) {
      if (i < uris.length && sampled.length < maxSample) {
        sampled.push(uris[i])
        added = true
      }
    }
    if (!added) break
  }

  return sampled
}

/**
 * Run discovery against an ArchivesSpace instance and write the manifest to disk,
 * overwriting any existing resources file.
 * @param {ASpace} aspace - Configured ASpace client
 * @param {object} [options] - Discovery configuration
 * @param {string} [options.resourcesFile='.astress-resources.json'] - Path to write resources manifest
 * @param {number} [options.maxSamplePerType=100] - Max URIs to sample per resource type
 * @returns {Promise<object>} Discovered resources manifest
 */
export async function discover(aspace, { resourcesFile = '.astress-resources.json', maxSamplePerType = 100 } = {}) {
  const repositories = await discoverRepositories(aspace)

  const resources = {}
  for (const type of GLOBAL_RESOURCES) {
    resources[type] = await discoverGlobal(aspace, type, maxSamplePerType)
  }
  for (const type of REPO_RESOURCES) {
    resources[type] = await discoverRepoScoped(aspace, repositories, type, maxSamplePerType)
  }

  const manifest = {
    repositories,
    resources,
  }

  writeFileSync(resourcesFile, JSON.stringify(manifest, null, 2))
  return manifest
}
