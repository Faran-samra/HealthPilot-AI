-- Phase 7+: Nationwide doctor location architecture
-- Normalized city slugs, indexes, location sync, expanded RPC, seed coverage

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS city_slug TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;

-- Backfill slugs and provinces from existing city names
UPDATE doctors d
SET
  city_slug = LOWER(TRIM(d.city)),
  province = c.province
FROM (VALUES
  ('lahore', 'Punjab'),
  ('karachi', 'Sindh'),
  ('islamabad', 'Federal'),
  ('rawalpindi', 'Punjab'),
  ('faisalabad', 'Punjab'),
  ('multan', 'Punjab'),
  ('peshawar', 'KPK'),
  ('quetta', 'Balochistan'),
  ('hyderabad', 'Sindh'),
  ('sialkot', 'Punjab'),
  ('gujranwala', 'Punjab'),
  ('abbottabad', 'KPK'),
  ('sargodha', 'Punjab'),
  ('sukkur', 'Sindh'),
  ('bahawalpur', 'Punjab'),
  ('muzaffarabad', 'AJK'),
  ('gilgit', 'GB'),
  ('mirpur', 'AJK')
) AS c(slug, province)
WHERE LOWER(TRIM(d.city)) = c.slug;

UPDATE doctors
SET city_slug = LOWER(TRIM(city))
WHERE city_slug IS NULL AND city IS NOT NULL;

-- Sync PostGIS location from lat/lng when missing
UPDATE doctors
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

-- Keep location in sync on insert/update
CREATE OR REPLACE FUNCTION sync_doctor_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;

  IF NEW.city IS NOT NULL THEN
    NEW.city_slug := LOWER(TRIM(NEW.city));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS doctors_sync_location ON doctors;
CREATE TRIGGER doctors_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude, city ON doctors
  FOR EACH ROW EXECUTE FUNCTION sync_doctor_location();

-- Search indexes for nationwide scale
CREATE INDEX IF NOT EXISTS doctors_city_slug_idx ON doctors (city_slug);
CREATE INDEX IF NOT EXISTS doctors_specialty_slug_idx ON doctors (specialty_slug);
CREATE INDEX IF NOT EXISTS doctors_city_specialty_idx ON doctors (city_slug, specialty_slug);
CREATE INDEX IF NOT EXISTS doctors_active_city_idx ON doctors (is_active, city_slug);

DROP FUNCTION IF EXISTS doctors_within_radius(double precision, double precision, double precision, text);

CREATE OR REPLACE FUNCTION doctors_within_radius(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 25,
  specialty_filter TEXT DEFAULT NULL,
  city_slug_filter TEXT DEFAULT NULL,
  area_filter TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  specialty TEXT,
  specialty_slug TEXT,
  hospital_name TEXT,
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
    d.address, d.city, d.city_slug, d.province, d.area, d.rating,
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
    AND (city_slug_filter IS NULL OR d.city_slug = city_slug_filter)
    AND (area_filter IS NULL OR d.area ILIKE '%' || area_filter || '%')
    AND ST_DWithin(d.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_km * 1000)
  ORDER BY distance_km ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Expand demo coverage: at least 2 verified doctors per major city
INSERT INTO doctors (
  full_name, specialty, specialty_slug, qualification, experience_years,
  hospital_name, address, city, city_slug, province, area, latitude, longitude,
  phone, whatsapp, consultation_fee, available_days, available_times,
  rating, total_reviews, is_verified, pmdc_number, gender, accepts_online, location
)
SELECT * FROM (VALUES
  ('Dr. Hassan Raza', 'General Physician', 'general', 'MBBS, FCPS', 14,
   'PIMS', 'Sector G-8, Islamabad', 'Islamabad', 'islamabad', 'Federal', 'G-8', 33.6844, 73.0479,
   '+923011111001', '+923011111001', 2000,
   ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::TEXT[],
   '{"start": "09:00", "end": "17:00"}'::jsonb,
   4.6, 95, TRUE, 'PMDC-50101', 'male', TRUE,
   ST_SetSRID(ST_MakePoint(73.0479, 33.6844), 4326)::geography),

  ('Dr. Ayesha Siddiqui', 'Gynecologist', 'gynecology', 'MBBS, FCPS (Obs/Gyn)', 11,
   'Shifa International', 'Sector H-8, Islamabad', 'Islamabad', 'islamabad', 'Federal', 'H-8', 33.6650, 73.0450,
   '+923011111002', '+923011111002', 3000,
   ARRAY['Monday','Wednesday','Friday']::TEXT[],
   '{"start": "10:00", "end": "16:00"}'::jsonb,
   4.8, 142, TRUE, 'PMDC-50102', 'female', TRUE,
   ST_SetSRID(ST_MakePoint(73.0450, 33.6650), 4326)::geography),

  ('Dr. Imran Butt', 'General Physician', 'general', 'MBBS, MCPS', 9,
   'Holy Family Hospital', 'Satellite Town, Rawalpindi', 'Rawalpindi', 'rawalpindi', 'Punjab', 'Satellite Town', 33.5651, 73.0169,
   '+923011111003', '+923011111003', 1200,
   ARRAY['Monday','Tuesday','Thursday','Saturday']::TEXT[],
   '{"start": "09:00", "end": "15:00"}'::jsonb,
   4.4, 67, TRUE, 'PMDC-50201', 'male', FALSE,
   ST_SetSRID(ST_MakePoint(73.0169, 33.5651), 4326)::geography),

  ('Dr. Nadia Akram', 'Pediatrician', 'pediatrics', 'MBBS, FCPS (Pediatrics)', 8,
   'Benazir Bhutto Hospital', 'Murree Road, Rawalpindi', 'Rawalpindi', 'rawalpindi', 'Punjab', 'Murree Road', 33.5900, 73.0600,
   '+923011111004', '+923011111004', 1800,
   ARRAY['Tuesday','Wednesday','Friday']::TEXT[],
   '{"start": "10:00", "end": "14:00"}'::jsonb,
   4.7, 88, TRUE, 'PMDC-50202', 'female', TRUE,
   ST_SetSRID(ST_MakePoint(73.0600, 33.5900), 4326)::geography),

  ('Dr. Tariq Mehmood', 'General Physician', 'general', 'MBBS', 16,
   'Allied Hospital', 'Sargodha Road, Faisalabad', 'Faisalabad', 'faisalabad', 'Punjab', 'Madina Town', 31.4180, 73.0790,
   '+923011111005', '+923011111005', 800,
   ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::TEXT[],
   '{"start": "08:00", "end": "16:00"}'::jsonb,
   4.3, 54, TRUE, 'PMDC-50301', 'male', FALSE,
   ST_SetSRID(ST_MakePoint(73.0790, 31.4180), 4326)::geography),

  ('Dr. Sana Iqbal', 'Dermatologist', 'dermatology', 'MBBS, FCPS', 7,
   'National Hospital', 'Jinnah Colony, Faisalabad', 'Faisalabad', 'faisalabad', 'Punjab', 'Jinnah Colony', 31.4500, 73.1200,
   '+923011111006', '+923011111006', 1500,
   ARRAY['Monday','Wednesday','Saturday']::TEXT[],
   '{"start": "11:00", "end": "19:00"}'::jsonb,
   4.5, 41, TRUE, 'PMDC-50302', 'female', TRUE,
   ST_SetSRID(ST_MakePoint(73.1200, 31.4500), 4326)::geography),

  ('Dr. Khalid Ansari', 'General Physician', 'general', 'MBBS, FCPS', 18,
   'Nishtar Hospital', 'Abdali Road, Multan', 'Multan', 'multan', 'Punjab', 'Abdali Road', 30.1575, 71.5249,
   '+923011111007', '+923011111007', 1000,
   ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::TEXT[],
   '{"start": "09:00", "end": "17:00"}'::jsonb,
   4.6, 112, TRUE, 'PMDC-50401', 'male', FALSE,
   ST_SetSRID(ST_MakePoint(71.5249, 30.1575), 4326)::geography),

  ('Dr. Rabia Noor', 'Gynecologist', 'gynecology', 'MBBS, MCPS', 10,
   'Mukhtar A. Sheikh Hospital', 'Khanewal Road, Multan', 'Multan', 'multan', 'Punjab', 'Gulgasht', 30.1800, 71.4800,
   '+923011111008', '+923011111008', 2200,
   ARRAY['Tuesday','Thursday','Saturday']::TEXT[],
   '{"start": "10:00", "end": "15:00"}'::jsonb,
   4.7, 76, TRUE, 'PMDC-50402', 'female', TRUE,
   ST_SetSRID(ST_MakePoint(71.4800, 30.1800), 4326)::geography),

  ('Dr. Faisal Afridi', 'General Physician', 'general', 'MBBS, FCPS', 13,
   'Lady Reading Hospital', 'Hospital Road, Peshawar', 'Peshawar', 'peshawar', 'KPK', 'Saddar', 34.0151, 71.5249,
   '+923011111009', '+923011111009', 1200,
   ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::TEXT[],
   '{"start": "09:00", "end": "16:00"}'::jsonb,
   4.5, 89, TRUE, 'PMDC-50501', 'male', FALSE,
   ST_SetSRID(ST_MakePoint(71.5249, 34.0151), 4326)::geography),

  ('Dr. Maryam Khattak', 'ENT Specialist', 'ent', 'MBBS, FCPS (ENT)', 9,
   'Rehman Medical Institute', 'Phase 5 Hayatabad, Peshawar', 'Peshawar', 'peshawar', 'KPK', 'Hayatabad', 33.9800, 71.4500,
   '+923011111010', '+923011111010', 2500,
   ARRAY['Monday','Wednesday','Friday']::TEXT[],
   '{"start": "10:00", "end": "16:00"}'::jsonb,
   4.8, 63, TRUE, 'PMDC-50502', 'female', TRUE,
   ST_SetSRID(ST_MakePoint(71.4500, 33.9800), 4326)::geography),

  ('Dr. Asad Baloch', 'General Physician', 'general', 'MBBS', 11,
   'Civil Hospital', 'Jinnah Road, Quetta', 'Quetta', 'quetta', 'Balochistan', 'Jinnah Road', 30.1798, 66.9750,
   '+923011111011', '+923011111011', 1000,
   ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday']::TEXT[],
   '{"start": "09:00", "end": "15:00"}'::jsonb,
   4.2, 38, TRUE, 'PMDC-50601', 'male', FALSE,
   ST_SetSRID(ST_MakePoint(66.9750, 30.1798), 4326)::geography),

  ('Dr. Zainab Kakar', 'Pediatrician', 'pediatrics', 'MBBS, DCH', 8,
   'Bolani Medical Complex', 'Sariab Road, Quetta', 'Quetta', 'quetta', 'Balochistan', 'Sariab', 30.2000, 67.0100,
   '+923011111012', '+923011111012', 1800,
   ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::TEXT[],
   '{"start": "10:00", "end": "14:00"}'::jsonb,
   4.6, 52, TRUE, 'PMDC-50602', 'female', TRUE,
   ST_SetSRID(ST_MakePoint(67.0100, 30.2000), 4326)::geography),

  ('Dr. Junaid Hashmi', 'General Physician', 'general', 'MBBS, FCPS', 12,
   'Liaquat University Hospital', 'Hyderabad Bypass, Hyderabad', 'Hyderabad', 'hyderabad', 'Sindh', 'Latifabad', 25.3924, 68.3737,
   '+923011111013', '+923011111013', 900,
   ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday']::TEXT[],
   '{"start": "09:00", "end": "17:00"}'::jsonb,
   4.4, 71, TRUE, 'PMDC-50701', 'male', FALSE,
   ST_SetSRID(ST_MakePoint(68.3737, 25.3924), 4326)::geography),

  ('Dr. Hina Soomro', 'Gynecologist', 'gynecology', 'MBBS, FCPS', 10,
   'Bilawal Medical Centre', 'Auto Bhan Road, Hyderabad', 'Hyderabad', 'hyderabad', 'Sindh', 'Qasimabad', 25.3800, 68.3500,
   '+923011111014', '+923011111014', 2000,
   ARRAY['Tuesday','Thursday','Saturday']::TEXT[],
   '{"start": "10:00", "end": "15:00"}'::jsonb,
   4.7, 84, TRUE, 'PMDC-50702', 'female', TRUE,
   ST_SetSRID(ST_MakePoint(68.3500, 25.3800), 4326)::geography),

  ('Dr. Waqas Cheema', 'Orthopedic', 'orthopedics', 'MBBS, FCPS (Ortho)', 14,
   'Allama Iqbal Memorial Hospital', 'Paris Road, Sialkot', 'Sialkot', 'sialkot', 'Punjab', 'Paris Road', 32.4945, 74.5229,
   '+923011111015', '+923011111015', 2500,
   ARRAY['Monday','Wednesday','Friday']::TEXT[],
   '{"start": "10:00", "end": "16:00"}'::jsonb,
   4.6, 59, TRUE, 'PMDC-50801', 'male', FALSE,
   ST_SetSRID(ST_MakePoint(74.5229, 32.4945), 4326)::geography),

  ('Dr. Amna Bukhari', 'General Physician', 'general', 'MBBS', 6,
   'Sialkot Medical Complex', 'Kashmir Road, Sialkot', 'Sialkot', 'sialkot', 'Punjab', 'Kashmir Road', 32.5100, 74.5400,
   '+923011111016', '+923011111016', 700,
   ARRAY['Monday','Tuesday','Thursday','Saturday']::TEXT[],
   '{"start": "09:00", "end": "14:00"}'::jsonb,
   4.3, 33, TRUE, 'PMDC-50802', 'female', TRUE,
   ST_SetSRID(ST_MakePoint(74.5400, 32.5100), 4326)::geography)
) AS v(
  full_name, specialty, specialty_slug, qualification, experience_years,
  hospital_name, address, city, city_slug, province, area, latitude, longitude,
  phone, whatsapp, consultation_fee, available_days, available_times,
  rating, total_reviews, is_verified, pmdc_number, gender, accepts_online, location
)
WHERE NOT EXISTS (
  SELECT 1 FROM doctors d WHERE d.full_name = v.full_name
);

-- Ensure original seed doctors have slugs/provinces
UPDATE doctors SET city_slug = 'lahore', province = 'Punjab' WHERE LOWER(city) = 'lahore' AND city_slug IS NULL;
UPDATE doctors SET city_slug = 'karachi', province = 'Sindh' WHERE LOWER(city) = 'karachi' AND city_slug IS NULL;
