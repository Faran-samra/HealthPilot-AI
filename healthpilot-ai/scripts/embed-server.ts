/**
 * Dev-only Node embedding server (same BGE model as ingest).
 * npm run embed:serve
 *
 * Production: deploy services/embedding-api (FastAPI) — see services/embedding-api/README.md
 */
import './load-env.ts'
import http from 'node:http'
import { embedLocalBatch, embedLocalQuery } from '../lib/embeddings-local.ts'

const PORT = Number(process.env.EMBEDDING_SERVER_PORT ?? 3847)

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/embed') {
    res.writeHead(404)
    res.end('POST /embed')
    return
  }

  try {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      query?: string
      texts?: string[]
    }

    res.setHeader('Content-Type', 'application/json')

    if (body.query) {
      const embedding = await embedLocalQuery(body.query)
      res.end(JSON.stringify({ embedding }))
      return
    }

    if (body.texts?.length) {
      const embeddings = await embedLocalBatch(body.texts)
      res.end(JSON.stringify({ embeddings }))
      return
    }

    res.writeHead(400)
    res.end(JSON.stringify({ error: 'Send { query } or { texts: string[] }' }))
  } catch (e) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
  }
})

server.listen(PORT, () => {
  console.log(`Embedding server http://127.0.0.1:${PORT}/embed`)
  console.log('Use EMBEDDING_PROVIDER=http and EMBEDDING_SERVICE_URL in edge secrets.')
})
