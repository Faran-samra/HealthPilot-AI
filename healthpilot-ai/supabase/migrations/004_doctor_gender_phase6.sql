-- Phase 6: Doctor gender for female-doctor filter + telemedicine seed updates

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

UPDATE doctors SET gender = 'female'
WHERE full_name ILIKE '%fatima%' OR full_name ILIKE '%sara%' OR full_name ILIKE '%dr. ayesha%';

UPDATE doctors SET gender = 'male'
WHERE gender IS NULL;

-- Enable online consultation for selected doctors
UPDATE doctors SET accepts_online = TRUE
WHERE full_name IN ('Dr. Fatima Khan', 'Dr. Sara Malik', 'Dr. Ahmed Hassan');

DROP FUNCTION IF EXISTS doctors_within_radius(double precision, double precision, double precision, text);

-- Recreate radius function with gender + accepts_online fields
CREATE OR REPLACE FUNCTION doctors_within_radius(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  specialty_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  specialty TEXT,
  specialty_slug TEXT,
  hospital_name TEXT,
  address TEXT,
  city TEXT,
  area TEXT,
  rating DECIMAL,
  consultation_fee INTEGER,
  phone TEXT,
  whatsapp TEXT,
  distance_km DOUBLE PRECISION,
  profile_image_url TEXT,
  is_verified BOOLEAN,
  qualification TEXT,
  experience_years INTEGER,
  total_reviews INTEGER,
  available_days TEXT[],
  available_times JSONB,
  pmdc_number TEXT,
  gender TEXT,
  accepts_online BOOLEAN,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.full_name, d.specialty, d.specialty_slug, d.hospital_name,
    d.address, d.city, d.area, d.rating,
    d.consultation_fee, d.phone, d.whatsapp,
    ROUND((ST_Distance(d.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) / 1000)::NUMERIC, 2)::DOUBLE PRECISION,
    d.profile_image_url, d.is_verified, d.qualification, d.experience_years,
    d.total_reviews, d.available_days, d.available_times, d.pmdc_number,
    d.gender, d.accepts_online, d.latitude, d.longitude
  FROM doctors d
  WHERE
    d.is_active = TRUE
    AND d.location IS NOT NULL
    AND (specialty_filter IS NULL OR d.specialty_slug = specialty_filter)
    AND ST_DWithin(d.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_km * 1000)
  ORDER BY distance_km ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
