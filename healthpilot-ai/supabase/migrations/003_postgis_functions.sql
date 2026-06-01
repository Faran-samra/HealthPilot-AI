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
  pmdc_number TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.full_name, d.specialty, d.specialty_slug, d.hospital_name,
    d.address, d.city, d.area, d.rating,
    d.consultation_fee, d.phone, d.whatsapp,
    ROUND((ST_Distance(d.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) / 1000)::NUMERIC, 2)::DOUBLE PRECISION,
    d.profile_image_url, d.is_verified, d.qualification, d.experience_years,
    d.total_reviews, d.available_days, d.available_times, d.pmdc_number
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

-- Auto-update doctor rating on review
CREATE OR REPLACE FUNCTION update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE doctors
  SET
    rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE doctor_id = NEW.doctor_id),
    total_reviews = (SELECT COUNT(*) FROM reviews WHERE doctor_id = NEW.doctor_id)
  WHERE id = NEW.doctor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_doctor_rating();
