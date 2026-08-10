import fs from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'

export const CONTENT_FOLDERS = ['monsters', 'items', 'floors', 'attributes', 'config'] as const
export type ContentFolder = (typeof CONTENT_FOLDERS)[number]

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i

function isAllowedFolder(folder: string): folder is ContentFolder {
  return (CONTENT_FOLDERS as readonly string[]).includes(folder)
}

function isSafeId(id: string): boolean {
  if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
    return false
  }
  return ID_PATTERN.test(id)
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body, null, 2))
}

/** PowerShell / some editors write UTF-8 BOM; JSON.parse rejects it. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function parseJsonFile(raw: string): unknown {
  return JSON.parse(stripBom(raw))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function parseRoute(urlPath: string): { folder: string; id?: string } | null {
  const match = /^\/api\/content\/([^/]+)(?:\/([^/]+))?\/?$/.exec(urlPath)
  if (!match) {
    return null
  }
  return { folder: decodeURIComponent(match[1]), id: match[2] ? decodeURIComponent(match[2]) : undefined }
}

export function contentFsPlugin(contentRoot: string): Plugin {
  return {
    name: 'skyspire-content-fs',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.method) {
          next()
          return
        }

        const url = new URL(req.url, 'http://localhost')
        if (!url.pathname.startsWith('/api/content')) {
          next()
          return
        }

        const route = parseRoute(url.pathname)
        if (!route) {
          sendJson(res, 404, { error: 'Not found' })
          return
        }

        if (!isAllowedFolder(route.folder)) {
          sendJson(res, 400, {
            error: `Folder not allowed. Use: ${CONTENT_FOLDERS.join(', ')}`,
          })
          return
        }

        const folderDir = path.join(contentRoot, route.folder)

        try {
          if (req.method === 'GET' && !route.id) {
            await fs.mkdir(folderDir, { recursive: true })
            const files = (await fs.readdir(folderDir))
              .filter((f) => f.endsWith('.json'))
              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

            const items: unknown[] = []
            for (const file of files) {
              const raw = await fs.readFile(path.join(folderDir, file), 'utf8')
              items.push(parseJsonFile(raw))
            }
            sendJson(res, 200, items)
            return
          }

          if (!route.id || !isSafeId(route.id)) {
            sendJson(res, 400, {
              error: 'Invalid id. Use kebab-case without path separators (e.g. slime, floor-01).',
            })
            return
          }

          const filePath = path.join(folderDir, `${route.id}.json`)

          if (req.method === 'GET') {
            try {
              const raw = await fs.readFile(filePath, 'utf8')
              sendJson(res, 200, parseJsonFile(raw))
            } catch (err) {
              const code = (err as NodeJS.ErrnoException).code
              if (code === 'ENOENT') {
                sendJson(res, 404, { error: `Not found: ${route.folder}/${route.id}` })
                return
              }
              throw err
            }
            return
          }

          if (req.method === 'PUT') {
            const bodyText = await readBody(req)
            let data: Record<string, unknown>
            try {
              data = JSON.parse(bodyText) as Record<string, unknown>
            } catch {
              sendJson(res, 400, { error: 'Body must be valid JSON' })
              return
            }

            if (typeof data.id === 'string' && data.id !== route.id) {
              sendJson(res, 400, { error: 'Body id must match URL id' })
              return
            }

            data.id = route.id
            await fs.mkdir(folderDir, { recursive: true })
            await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
            sendJson(res, 200, data)
            return
          }

          if (req.method === 'DELETE') {
            try {
              await fs.unlink(filePath)
              sendJson(res, 200, { ok: true, id: route.id })
            } catch (err) {
              const code = (err as NodeJS.ErrnoException).code
              if (code === 'ENOENT') {
                sendJson(res, 404, { error: `Not found: ${route.folder}/${route.id}` })
                return
              }
              throw err
            }
            return
          }

          sendJson(res, 405, { error: 'Method not allowed' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}
