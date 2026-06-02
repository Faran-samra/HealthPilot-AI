-- Phase B: review queue, multi-source records, claims, PMDC verification

DO $$ BEGIN
  CREATE TYPE import_review_status AS ENUM ('pending', 'approved', 'rejected', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE doctor_publication_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pmdc_queue_status AS ENUM ('pending', 'processing', 'verified', 'failed', 'not_found');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE doctor_claim_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS publication_status doctor_publication_status DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS doctors_publication_idx ON doctors (publication_status);
CREATE UNIQUE INDEX IF NOT EXISTS doctors_pmdc_number_unique_idx
  ON doctors (pmdc_number) WHERE pmdc_number IS NOT NULL AND pmdc_number <> '';

ALTER TABLE doctor_import_raw
  ADD COLUMN IF NOT EXISTS review_status import_review_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS normalized_payload JSONB,
  ADD COLUMN IF NOT EXISTS fetch_status TEXT DEFAULT 'sitemap_only',
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS doctor_import_raw_review_idx ON doctor_import_raw (review_status);
CREATE INDEX IF NOT EXISTS doctor_import_raw_pending_idx ON doctor_import_raw (review_status)
  WHERE review_status = 'pending';

-- Multiple marketplace sources linked to one canonical doctor
CREATE TABLE IF NOT EXISTS doctor_source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  source doctor_data_source NOT NULL,
  external_id TEXT NOT NULL,
  source_url TEXT,
  import_raw_id UUID REFERENCES doctor_import_raw(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS doctor_source_records_doctor_idx ON doctor_source_records (doctor_id);

ALTER TABLE doctor_source_records ENABLE ROW LEVEL SECURITY;

-- PMDC verification queue (on-demand / batch)
CREATE TABLE IF NOT EXISTS pmdc_verification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  import_raw_id UUID REFERENCES doctor_import_raw(id) ON DELETE CASCADE,
  pmdc_number TEXT,
  full_name TEXT NOT NULL,
  father_name TEXT,
  status pmdc_queue_status DEFAULT 'pending',
  result JSONB,
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pmdc_queue_status_idx ON pmdc_verification_queue (status)
  WHERE status IN ('pending', 'processing');

-- Doctor profile claims (community verified path)
CREATE TABLE IF NOT EXISTS doctor_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pmdc_number TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  evidence JSONB DEFAULT '{}',
  status doctor_claim_status DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (doctor_id, user_id)
);

CREATE INDEX IF NOT EXISTS doctor_claims_status_idx ON doctor_claims (status);

ALTER TABLE pmdc_verification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_claims ENABLE ROW LEVEL SECURITY;

-- Claims: users manage own submissions
CREATE POLICY doctor_claims_select_own ON doctor_claims
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY doctor_claims_insert_own ON doctor_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Published doctors readable by everyone (existing doctors policy may exist — ensure published only in RPC)

-- Recompute verification from source_count + PMDC
CREATE OR REPLACE FUNCTION recompute_doctor_verification(p_doctor_id UUID)
RETURNS void AS $$
DECLARE
  d RECORD;
  src_cnt INTEGER;
BEGIN
  SELECT * INTO d FROM doctors WHERE id = p_doctor_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(DISTINCT source) INTO src_cnt
  FROM doctor_source_records WHERE doctor_id = p_doctor_id;

  IF d.claimed_by IS NOT NULL THEN
    UPDATE doctors SET
      verification_status = 'community_verified',
      is_verified = TRUE,
      source_count = GREATEST(COALESCE(src_cnt, 0), COALESCE(d.source_count, 1)),
      updated_at = NOW()
    WHERE id = p_doctor_id;
    RETURN;
  END IF;

  IF d.pmdc_number IS NOT NULL AND EXISTS (
    SELECT 1 FROM pmdc_verification_queue q
    WHERE q.doctor_id = p_doctor_id AND q.status = 'verified'
  ) THEN
    UPDATE doctors SET
      verification_status = CASE
        WHEN COALESCE(src_cnt, d.source_count, 1) >= 2 THEN 'cross_verified'::doctor_verification_status
        ELSE 'verified'::doctor_verification_status
      END,
      is_verified = TRUE,
      source_count = GREATEST(COALESCE(src_cnt, 0), COALESCE(d.source_count, 1)),
      updated_at = NOW()
    WHERE id = p_doctor_id;
    RETURN;
  END IF;

  IF COALESCE(src_cnt, d.source_count, 1) >= 2 THEN
    UPDATE doctors SET
      verification_status = 'cross_verified',
      source_count = src_cnt,
      updated_at = NOW()
    WHERE id = p_doctor_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit doctor claim
CREATE OR REPLACE FUNCTION submit_doctor_claim(
  p_doctor_id UUID,
  p_pmdc_number TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_evidence JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  d RECORD;
  claim_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO d FROM doctors WHERE id = p_doctor_id AND publication_status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor not found';
  END IF;

  INSERT INTO doctor_claims (doctor_id, user_id, pmdc_number, full_name, phone, evidence)
  VALUES (
    p_doctor_id,
    auth.uid(),
    NULLIF(TRIM(p_pmdc_number), ''),
    d.full_name,
    NULLIF(TRIM(p_phone), ''),
    COALESCE(p_evidence, '{}')
  )
  ON CONFLICT (doctor_id, user_id) DO UPDATE SET
    pmdc_number = EXCLUDED.pmdc_number,
    phone = EXCLUDED.phone,
    evidence = EXCLUDED.evidence,
    status = 'pending',
    created_at = NOW()
  RETURNING id INTO claim_id;

  IF NULLIF(TRIM(p_pmdc_number), '') IS NOT NULL THEN
    INSERT INTO pmdc_verification_queue (doctor_id, pmdc_number, full_name, status)
    VALUES (p_doctor_id, TRIM(p_pmdc_number), d.full_name, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN claim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Queue PMDC verification for a doctor or import row
CREATE OR REPLACE FUNCTION queue_pmdc_verification(
  p_doctor_id UUID DEFAULT NULL,
  p_import_raw_id UUID DEFAULT NULL,
  p_pmdc_number TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_father_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  q_id UUID;
  v_name TEXT;
  v_pmdc TEXT;
BEGIN
  IF p_doctor_id IS NOT NULL THEN
    SELECT full_name, pmdc_number INTO v_name, v_pmdc FROM doctors WHERE id = p_doctor_id;
  ELSIF p_import_raw_id IS NOT NULL THEN
    SELECT full_name, pmdc_number INTO v_name, v_pmdc FROM doctor_import_raw WHERE id = p_import_raw_id;
  END IF;

  v_name := COALESCE(p_full_name, v_name);
  v_pmdc := COALESCE(NULLIF(TRIM(p_pmdc_number), ''), v_pmdc);

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'full_name required';
  END IF;

  INSERT INTO pmdc_verification_queue (doctor_id, import_raw_id, pmdc_number, full_name, father_name, status)
  VALUES (p_doctor_id, p_import_raw_id, v_pmdc, v_name, p_father_name, 'pending')
  RETURNING id INTO q_id;

  RETURN q_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Extended radius search with min_fee + language + published only
DROP FUNCTION IF EXISTS doctors_within_radius(double precision, double precision, double precision, text, text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION doctors_within_radius(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 25,
  specialty_filter TEXT DEFAULT NULL,
  city_slug_filter TEXT DEFAULT NULL,
  area_filter TEXT DEFAULT NULL,
  name_filter TEXT DEFAULT NULL,
  gender_filter TEXT DEFAULT NULL,
  max_fee_filter INTEGER DEFAULT NULL,
  min_fee_filter INTEGER DEFAULT NULL,
  language_filter TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  specialty TEXT,
  specialty_slug TEXT,
  hospital_name TEXT,
  clinic_name TEXT,
  address TEXT,
  city TEXT,
  city_slug TEXT,
  province TEXT,
  area TEXT,
  rating DECIMAL,
  consultation_fee INTEGER,
  phone TEXT,
  whatsapp TEXT,
  distance_km DOUBLE PRECISION,
  profile_image_url TEXT,
  is_verified BOOLEAN,
  verification_status doctor_verification_status,
  qualification TEXT,
  experience_years INTEGER,
  total_reviews INTEGER,
  available_days TEXT[],
  available_times JSONB,
  pmdc_number TEXT,
  gender TEXT,
  accepts_online BOOLEAN,
  languages TEXT[],
  source doctor_data_source,
  source_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  source_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.full_name, d.specialty, d.specialty_slug, d.hospital_name, d.clinic_name,
    d.address, d.city, d.city_slug, d.province, d.area, d.rating,
    d.consultation_fee, d.phone, d.whatsapp,
    ROUND((ST_Distance(d.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) / 1000)::NUMERIC, 2)::DOUBLE PRECISION,
    d.profile_image_url, d.is_verified, d.verification_status, d.qualification, d.experience_years,
    d.total_reviews, d.available_days, d.available_times, d.pmdc_number,
    d.gender, d.accepts_online, d.languages, d.source, d.source_url,
    d.latitude, d.longitude, d.source_count
  FROM doctors d
  WHERE
    d.is_active = TRUE
    AND d.publication_status = 'published'
    AND d.location IS NOT NULL
    AND ST_DWithin(
      d.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_km * 1000
    )
    AND (specialty_filter IS NULL OR d.specialty_slug = specialty_filter)
    AND (city_slug_filter IS NULL OR d.city_slug = city_slug_filter)
    AND (area_filter IS NULL OR d.area ILIKE '%' || area_filter || '%')
    AND (name_filter IS NULL OR d.full_name ILIKE '%' || name_filter || '%')
    AND (gender_filter IS NULL OR d.gender = gender_filter)
    AND (max_fee_filter IS NULL OR d.consultation_fee IS NULL OR d.consultation_fee <= max_fee_filter)
    AND (min_fee_filter IS NULL OR d.consultation_fee IS NULL OR d.consultation_fee >= min_fee_filter)
    AND (
      language_filter IS NULL
      OR d.languages IS NULL
      OR EXISTS (
        SELECT 1 FROM unnest(d.languages) lang
        WHERE lang ILIKE '%' || language_filter || '%'
      )
    )
  ORDER BY
    CASE d.verification_status
      WHEN 'community_verified' THEN 1
      WHEN 'cross_verified' THEN 2
      WHEN 'verified' THEN 3
      ELSE 4
    END,
    distance_km ASC,
    d.rating DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- City/nationwide directory search (no GPS required)
CREATE OR REPLACE FUNCTION search_doctors_directory(
  city_slug_filter TEXT DEFAULT NULL,
  specialty_filter TEXT DEFAULT NULL,
  area_filter TEXT DEFAULT NULL,
  name_filter TEXT DEFAULT NULL,
  hospital_filter TEXT DEFAULT NULL,
  gender_filter TEXT DEFAULT NULL,
  max_fee_filter INTEGER DEFAULT NULL,
  min_fee_filter INTEGER DEFAULT NULL,
  language_filter TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 50,
  result_offset INTEGER DEFAULT 0
)
RETURNS SETOF doctors AS $$
BEGIN
  RETURN QUERY
  SELECT d.*
  FROM doctors d
  WHERE
    d.is_active = TRUE
    AND d.publication_status = 'published'
    AND (city_slug_filter IS NULL OR d.city_slug = city_slug_filter)
    AND (specialty_filter IS NULL OR d.specialty_slug = specialty_filter)
    AND (area_filter IS NULL OR d.area ILIKE '%' || area_filter || '%')
    AND (name_filter IS NULL OR d.full_name ILIKE '%' || name_filter || '%')
    AND (
      hospital_filter IS NULL
      OR d.hospital_name ILIKE '%' || hospital_filter || '%'
      OR d.clinic_name ILIKE '%' || hospital_filter || '%'
    )
    AND (gender_filter IS NULL OR d.gender = gender_filter)
    AND (max_fee_filter IS NULL OR d.consultation_fee IS NULL OR d.consultation_fee <= max_fee_filter)
    AND (min_fee_filter IS NULL OR d.consultation_fee IS NULL OR d.consultation_fee >= min_fee_filter)
    AND (
      language_filter IS NULL
      OR d.languages IS NULL
      OR EXISTS (
        SELECT 1 FROM unnest(d.languages) lang
        WHERE lang ILIKE '%' || language_filter || '%'
      )
    )
  ORDER BY
    CASE d.verification_status
      WHEN 'community_verified' THEN 1
      WHEN 'cross_verified' THEN 2
      WHEN 'verified' THEN 3
      ELSE 4
    END,
    d.rating DESC NULLS LAST,
    d.total_reviews DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION submit_doctor_claim TO authenticated;
GRANT EXECUTE ON FUNCTION queue_pmdc_verification TO authenticated;
GRANT EXECUTE ON FUNCTION recompute_doctor_verification TO service_role;
GRANT EXECUTE ON FUNCTION search_doctors_directory TO anon, authenticated;
