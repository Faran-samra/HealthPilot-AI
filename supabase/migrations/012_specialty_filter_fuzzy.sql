-- Broader specialty matching for directory search (Marham slugs vs UI filter slugs).

CREATE OR REPLACE FUNCTION doctor_specialty_matches(
  p_slug TEXT,
  p_label TEXT,
  p_filter TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  slug_l TEXT := lower(coalesce(p_slug, ''));
  label_l TEXT := lower(coalesce(p_label, ''));
BEGIN
  IF p_filter IS NULL OR p_filter = '' THEN
    RETURN TRUE;
  END IF;

  IF slug_l = p_filter THEN
    RETURN TRUE;
  END IF;

  IF slug_l LIKE p_filter || '%' OR slug_l LIKE '%' || p_filter || '%' THEN
    RETURN TRUE;
  END IF;

  CASE p_filter
    WHEN 'general' THEN
      RETURN slug_l IN ('general', 'general_physician', 'general_practitioner')
        OR label_l LIKE '%general physician%'
        OR label_l LIKE '%general practitioner%'
        OR label_l LIKE '%family medicine%';
    WHEN 'cardiology' THEN
      RETURN slug_l LIKE '%cardio%' OR label_l LIKE '%cardiolog%' OR label_l LIKE '%heart specialist%';
    WHEN 'dermatology' THEN
      RETURN slug_l LIKE '%dermat%' OR label_l LIKE '%dermatolog%' OR label_l LIKE '%skin specialist%';
    WHEN 'gynecology' THEN
      RETURN slug_l LIKE '%gynec%' OR slug_l LIKE '%gynaec%' OR label_l LIKE '%gynecolog%' OR label_l LIKE '%gynaecolog%';
    WHEN 'pediatrics' THEN
      RETURN slug_l LIKE '%pediatr%' OR slug_l LIKE '%paediatr%' OR label_l LIKE '%pediatric%';
    WHEN 'orthopedics' THEN
      RETURN slug_l LIKE '%orthop%' OR label_l LIKE '%orthop%';
    WHEN 'ent' THEN
      RETURN slug_l IN ('ent', 'ent_surgeon', 'otolaryngologist')
        OR label_l LIKE '%ent %' OR label_l LIKE '%ent surgeon%' OR label_l LIKE '%otolaryng%';
    WHEN 'ophthalmology' THEN
      RETURN slug_l LIKE '%ophthalm%' OR label_l LIKE '%ophthalmolog%' OR label_l LIKE '%eye specialist%';
    WHEN 'psychiatry' THEN
      RETURN slug_l LIKE '%psychiatr%' OR label_l LIKE '%psychiatr%';
    WHEN 'urology' THEN
      RETURN slug_l LIKE '%urolog%' OR label_l LIKE '%urolog%';
    WHEN 'gastroenterology' THEN
      RETURN slug_l LIKE '%gastro%' OR label_l LIKE '%gastroenterolog%';
    WHEN 'endocrinology' THEN
      RETURN slug_l LIKE '%endocrin%' OR label_l LIKE '%endocrinolog%';
    WHEN 'pulmonology' THEN
      RETURN slug_l LIKE '%pulmon%' OR label_l LIKE '%lung specialist%' OR label_l LIKE '%pulmonolog%';
    WHEN 'neurology' THEN
      RETURN slug_l LIKE '%neuro%' OR label_l LIKE '%neurolog%';
    ELSE
      RETURN label_l LIKE '%' || replace(p_filter, '_', ' ') || '%';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
