/**
 * Free local embeddings (BGE-large-en-v1.5, 1024 dims) — no API keys or rate limits.
 */
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers'
import { EMBEDDING_DIM } from './embeddings.ts'

const MODEL = 'Xenova/bge-large-en-v1.5'

let loadPromise: Promise<FeatureExtractionPipeline> | null = null

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!loadPromise) {
    loadPromise = (async () => {
      console.log(`Loading local model ${MODEL} (first run downloads ~1GB)...`)
      return pipeline('feature-extraction', MODEL, { quantized: true })
    })()
  }
  return loadPromise
}

async function embedOne(text: string): Promise<number[]> {
  const ext = await getExtractor()
  const out = await ext(text.slice(0, 512), { pooling: 'mean', normalize: true })
  const v = Array.from(out.data as Float32Array)
  if (v.length !== EMBEDDING_DIM) {
    throw new Error(`Local model returned ${v.length} dims, expected ${EMBEDDING_DIM}`)
  }
  return v
}

export async function embedLocalBatch(texts: string[], batchSize = 16): Promise<number[][]> {
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize)
    const batch = await Promise.all(slice.map((t) => embedOne(t)))
    out.push(...batch)
    if (i + batchSize < texts.length) {
      console.log(`  embedded ${Math.min(i + batchSize, texts.length)} / ${texts.length}`)
    }
  }
  return out
}

export async function embedLocalQuery(text: string): Promise<number[]> {
  return embedOne(text)
}
