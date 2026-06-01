-- Phase B/C: LLM observability, feedback, RAG tables (pgvector)

-- ---------------------------------------------------------------------------
-- AI request traces (no raw symptom text — metadata only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  function_name TEXT NOT NULL,
  model TEXT,
  input_tokens INT,
  output_tokens INT,
  latency_ms INT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error', 'validation_failed')),
  error_message TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id UUID REFERENCES symptom_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_traces_trace_id_idx ON ai_traces(trace_id);
CREATE INDEX IF NOT EXISTS ai_traces_created_at_idx ON ai_traces(created_at DESC);

ALTER TABLE ai_traces ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only service role (edge functions) can read/write traces.

-- ---------------------------------------------------------------------------
-- Human feedback on analyses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES symptom_sessions(id) ON DELETE SET NULL,
  trace_id TEXT,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  comment TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_feedback_trace_id_idx ON analysis_feedback(trace_id);

ALTER TABLE analysis_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON analysis_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read own feedback"
  ON analysis_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RAG corpus (Phase D) — enable pgvector when ready to seed embeddings
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS medical_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  specialty_tags TEXT[] DEFAULT '{}',
  embedding vector(1024),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS medical_chunks_specialty_tags_idx
  ON medical_chunks USING GIN (specialty_tags);

-- IVFFlat index: create after seeding rows (requires rows > lists)
-- CREATE INDEX medical_chunks_embedding_idx ON medical_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

CREATE OR REPLACE FUNCTION match_medical_chunks(
  query_embedding vector(1024),
  match_count int DEFAULT 4,
  filter_specialty text DEFAULT NULL
)
RETURNS TABLE (
  slug text,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.slug,
    mc.title,
    mc.content,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM medical_chunks mc
  WHERE mc.embedding IS NOT NULL
    AND (filter_specialty IS NULL OR filter_specialty = ANY(mc.specialty_tags))
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

ALTER TABLE medical_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read medical_chunks"
  ON medical_chunks FOR SELECT
  USING (true);
