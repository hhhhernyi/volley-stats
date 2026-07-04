/**
 * http-client.ts — rate-limited fetch with disk cache.
 *
 * Rules:
 * - If the target file already exists on disk → return cached content, no network call.
 * - Otherwise → wait for the rate-limit delay → fetch → write to disk → return content.
 * - Re-running is always safe: completed files are never re-fetched unless --force-refresh.
 */

import fs from 'fs/promises'
import path from 'path'
import { REQUEST_DELAY_MS, USER_AGENT } from './constants.js'

let lastRequestAt = 0

/** Ensure delay of REQUEST_DELAY_MS between network requests. */
async function throttle(): Promise<void> {
  const now  = Date.now()
  const wait = lastRequestAt + REQUEST_DELAY_MS - now
  if (wait > 0) {
    await new Promise<void>((r) => setTimeout(r, wait))
  }
  lastRequestAt = Date.now()
}

/**
 * Fetch a URL and cache the raw HTML to `filePath`.
 * Returns the HTML string.
 *
 * @param url         - Full URL to fetch
 * @param filePath    - Absolute or project-relative path to write/read cache
 * @param forceRefresh - If true, skip cache and always re-fetch
 * @param userAgent   - Override UA (legavolley.it 403s non-browser agents)
 */
export async function fetchAndCache(
  url: string,
  filePath: string,
  forceRefresh = false,
  userAgent: string = USER_AGENT,
): Promise<string> {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)

  // Cache hit
  if (!forceRefresh) {
    try {
      const cached = await fs.readFile(abs, 'utf8')
      process.stdout.write(`  [cache] ${url}\n`)
      return cached
    } catch {
      // File doesn't exist — fall through to network
    }
  }

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(abs), { recursive: true })

  // Network fetch (rate-limited)
  await throttle()
  process.stdout.write(`  [fetch] ${url}\n`)

  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`)
  }

  const html = await response.text()
  await fs.writeFile(abs, html, 'utf8')
  return html
}

/**
 * Read a file from disk (landing layer only — no network).
 * Throws if the file doesn't exist.
 */
export async function readLanding(filePath: string): Promise<string> {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)
  return fs.readFile(abs, 'utf8')
}

/**
 * Write JSON to disk (parse phase output).
 */
export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * Read JSON from disk.
 */
export async function readJson<T>(filePath: string): Promise<T> {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)
  const raw = await fs.readFile(abs, 'utf8')
  return JSON.parse(raw) as T
}

/**
 * Check whether a file exists on disk.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)
  try {
    await fs.access(abs)
    return true
  } catch {
    return false
  }
}
