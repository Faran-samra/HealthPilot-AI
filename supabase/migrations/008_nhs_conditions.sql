-- NHS structured conditions + RAG chunk metadata

-- ---------------------------------------------------------------------------
-- Structured NHS conditions (transformed, not raw HTML)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nhs_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  condition_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'nhs_uk',
  licence TEXT NOT NULL DEFAULT 'OGL-3.0',
  category TEXT NOT NULL DEFAULT 'A-Z conditions',
  sections JSONB NOT NULL DEFAULT '{}',
  when_to_seek_help_uk TEXT,
  emergency_advice_pakistan TEXT,
  localized_pakistan_context TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  localized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nhs_conditions_slug_idx ON nhs_conditions(slug);
CREATE INDEX IF NOT EXISTS nhs_conditions_name_idx ON nhs_conditions(condition_name);

ALTER TABLE nhs_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read nhs_conditions"
  ON nhs_conditions FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- Extend medical_chunks for multi-source RAG
-- ---------------------------------------------------------------------------
ALTER TABLE medical_chunks
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pakistan',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS condition_slug TEXT,
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';

CREATE INDEX IF NOT EXISTS medical_chunks_source_idx ON medical_chunks(source);
CREATE INDEX IF NOT EXISTS medical_chunks_condition_slug_idx ON medical_chunks(condition_slug);

-- Prefer Pakistan + emergency sections in retrieval
CREATE OR REPLACE FUNCTION match_medical_chunks(
  query_embedding vector(1024),
  match_count int DEFAULT 6,
  filter_specialty text DEFAULT NULL,
  prefer_sources text[] DEFAULT ARRAY['pakistan', 'nhs_uk']
)
RETURNS TABLE (
  slug text,
  title text,
  content text,
  source text,
  section text,
  source_url text,
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
    mc.source,
    mc.section,
    mc.source_url,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM medical_chunks mc
  WHERE mc.embedding IS NOT NULL
    AND (filter_specialty IS NULL OR filter_specialty = ANY(mc.specialty_tags))
  ORDER BY
    CASE
      WHEN mc.source = ANY(prefer_sources) AND mc.section IN ('emergency_advice_pakistan', 'localized_pakistan_context') THEN 0
      WHEN mc.source = 'pakistan' THEN 1
      WHEN mc.source = 'nhs_uk' AND mc.section NOT IN ('when_to_seek_help_uk') THEN 2
      ELSE 3
    END,
    mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
