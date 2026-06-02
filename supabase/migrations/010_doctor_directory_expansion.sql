-- Doctor directory expansion: sources, verification, staging imports

DO $$ BEGIN
  CREATE TYPE doctor_data_source AS ENUM (
    'pmdc', 'marham', 'oladoc', 'hamariweb', 'osm', 'manual', 'healthpilot'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE doctor_verification_status AS ENUM (
    'unverified', 'verified', 'cross_verified', 'community_verified'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS clinic_name TEXT,
  ADD COLUMN IF NOT EXISTS source doctor_data_source DEFAULT 'healthpilot',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_status doctor_verification_status DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS doctors_source_idx ON doctors (source);
CREATE INDEX IF NOT EXISTS doctors_verification_idx ON doctors (verification_status);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS doctors_name_trgm_idx ON doctors USING gin (full_name gin_trgm_ops);

-- Raw imports before dedupe/merge
CREATE TABLE IF NOT EXISTS doctor_import_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source doctor_data_source NOT NULL,
  external_id TEXT,
  payload JSONB NOT NULL,
  full_name TEXT,
  specialty_raw TEXT,
  city_raw TEXT,
  pmdc_number TEXT,
  source_url TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  merged_doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS doctor_import_raw_source_idx ON doctor_import_raw (source);
CREATE INDEX IF NOT EXISTS doctor_import_raw_merged_idx ON doctor_import_raw (merged_doctor_id);

ALTER TABLE doctor_import_raw ENABLE ROW LEVEL SECURITY;

-- Staging: service role only (no public policies)

-- Sync verification from legacy is_verified + pmdc
UPDATE doctors
SET verification_status = CASE
  WHEN pmdc_number IS NOT NULL AND is_verified THEN 'verified'::doctor_verification_status
  WHEN pmdc_number IS NOT NULL THEN 'verified'::doctor_verification_status
  ELSE 'unverified'::doctor_verification_status
END
WHERE verification_status IS NULL OR verification_status = 'unverified';

UPDATE doctors SET source = 'healthpilot' WHERE source IS NULL;

-- Extended radius search for directory
DROP FUNCTION IF EXISTS doctors_within_radius(double precision, double precision, double precision, text, text, text, integer);

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
  longitude DOUBLE PRECISION
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
    d.latitude, d.longitude
  FROM doctors d
  WHERE
    d.is_active = TRUE
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
  ORDER BY distance_km ASC, d.rating DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;
