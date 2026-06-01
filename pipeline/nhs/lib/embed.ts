export {
  embedText,
  embedTextsBatch,
  embedQuery,
  embedThrottleMs,
  resolveEmbeddingProvider,
  EmbeddingApiError,
} from '../../../lib/embeddings.ts'

import { embedText } from '../../../lib/embeddings.ts'
import { sleep } from './fs.ts'

export async function embedBatch(texts: string[], delayMs = 200): Promise<number[][]> {
  const out: number[][] = []
  for (const text of texts) {
    out.push(await embedText(text))
    if (delayMs > 0) await sleep(delayMs)
  }
  return out
}
