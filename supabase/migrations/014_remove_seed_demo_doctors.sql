-- Remove legacy HealthPilot demo/seed doctors (002 + 006 migrations).
-- Directory listings should be Marham-ingested (and future marketplace sources), not fake PMDC cards.

-- Demo phone prefixes used only in seed data
DELETE FROM doctors
WHERE
  source IN ('healthpilot', 'manual')
  OR (
    source IS NULL
    AND (source_url IS NULL OR source_url = '')
    AND (
      pmdc_number ~ '^PMDC-(12345|23456|34567|45678|50)'
      OR phone ~ '^\+92300123456[7-9]?$'
      OR phone ~ '^\+9230111110(0[1-9]|1[0-6])$'
      OR whatsapp ~ '^\+92300123456[7-9]?$'
      OR whatsapp ~ '^\+9230111110(0[1-9]|1[0-6])$'
    )
  );

-- Exclude demo sources from directory RPCs
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
    AND COALESCE(d.source::text, '') NOT IN ('healthpilot', 'manual')
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
    AND COALESCE(d.source::text, '') NOT IN ('healthpilot', 'manual')
    AND (city_slug_filter IS NULL OR d.city_slug = city_slug_filter)
    AND doctor_specialty_matches(d.specialty_slug, d.specialty, specialty_filter)
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
