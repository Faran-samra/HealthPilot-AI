INSERT INTO specialties (name, slug, name_urdu, icon, common_symptoms) VALUES
  ('General Physician', 'general', 'جنرل فزیشن', 'stethoscope', ARRAY['fever','cold','cough','fatigue','headache']),
  ('Cardiologist', 'cardiology', 'امراض قلب', 'heart', ARRAY['chest pain','shortness of breath','palpitations']),
  ('Dermatologist', 'dermatology', 'امراض جلد', 'shield', ARRAY['rash','acne','skin irritation','hair loss']),
  ('Orthopedic', 'orthopedics', 'ہڈیوں کا ڈاکٹر', 'bone', ARRAY['joint pain','back pain','fracture','swelling']),
  ('Gynecologist', 'gynecology', 'امراض نسواں', 'baby', ARRAY['menstrual issues','pregnancy','pelvic pain']),
  ('Pediatrician', 'pediatrics', 'بچوں کا ڈاکٹر', 'child', ARRAY['child fever','growth issues','vaccination']),
  ('Neurologist', 'neurology', 'اعصابی امراض', 'brain', ARRAY['headache','dizziness','seizure','numbness']),
  ('ENT Specialist', 'ent', 'کان ناک گلے', 'ear', ARRAY['ear pain','sore throat','hearing loss','nasal congestion']),
  ('Ophthalmologist', 'ophthalmology', 'آنکھوں کا ڈاکٹر', 'eye', ARRAY['blurry vision','eye pain','redness']),
  ('Psychiatrist', 'psychiatry', 'امراض نفسیات', 'brain-circuit', ARRAY['anxiety','depression','stress','insomnia']),
  ('Urologist', 'urology', 'پیشاب کی تکلیف', 'droplet', ARRAY['urinary pain','kidney stones','frequent urination']),
  ('Gastroenterologist', 'gastroenterology', 'معدے کا ڈاکٹر', 'stomach', ARRAY['stomach pain','nausea','diarrhea','constipation']),
  ('Endocrinologist', 'endocrinology', 'ذیابیطس', 'activity', ARRAY['diabetes','thyroid','weight gain','fatigue']),
  ('Pulmonologist', 'pulmonology', 'پھیپھڑوں کا ڈاکٹر', 'wind', ARRAY['breathing difficulty','asthma','chest tightness','cough']);

-- Sample doctors for development (Lahore & Karachi)
INSERT INTO doctors (
  full_name, specialty, specialty_slug, qualification, experience_years,
  hospital_name, address, city, area, latitude, longitude,
  phone, whatsapp, consultation_fee, available_days, available_times,
  rating, total_reviews, is_verified, pmdc_number, location
) VALUES
(
  'Dr. Ahmed Hassan', 'General Physician', 'general', 'MBBS, FCPS', 12,
  'Services Hospital', 'Jail Road, Lahore', 'Lahore', 'Gulberg', 31.5204, 74.3587,
  '+923001234567', '+923001234567', 1500,
  ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  '{"start": "09:00", "end": "17:00"}'::jsonb,
  4.7, 128, TRUE, 'PMDC-12345',
  ST_SetSRID(ST_MakePoint(74.3587, 31.5204), 4326)::geography
),
(
  'Dr. Fatima Khan', 'Cardiologist', 'cardiology', 'MBBS, FCPS (Cardiology)', 15,
  'Shaukat Khanum Memorial', 'Johar Town, Lahore', 'Lahore', 'Johar Town', 31.4697, 74.2728,
  '+923001234568', '+923001234568', 3500,
  ARRAY['Monday','Wednesday','Friday'],
  '{"start": "10:00", "end": "16:00"}'::jsonb,
  4.9, 89, TRUE, 'PMDC-23456',
  ST_SetSRID(ST_MakePoint(74.2728, 31.4697), 4326)::geography
),
(
  'Dr. Usman Ali', 'Dermatologist', 'dermatology', 'MBBS, MCPS', 8,
  'Doctors Hospital', 'Canal Road, Lahore', 'Lahore', 'DHA', 31.4800, 74.4100,
  '+923001234569', '+923001234569', 2000,
  ARRAY['Tuesday','Thursday','Saturday'],
  '{"start": "11:00", "end": "19:00"}'::jsonb,
  4.5, 56, TRUE, 'PMDC-34567',
  ST_SetSRID(ST_MakePoint(74.4100, 31.4800), 4326)::geography
),
(
  'Dr. Sara Malik', 'Pediatrician', 'pediatrics', 'MBBS, FCPS (Pediatrics)', 10,
  'Aga Khan University Hospital', 'Stadium Road, Karachi', 'Karachi', 'Karachi', 24.8607, 67.0011,
  '+923001234570', '+923001234570', 2500,
  ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday'],
  '{"start": "09:00", "end": "14:00"}'::jsonb,
  4.8, 203, TRUE, 'PMDC-45678',
  ST_SetSRID(ST_MakePoint(67.0011, 24.8607), 4326)::geography
);
