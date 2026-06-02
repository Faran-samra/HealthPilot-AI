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

-- Demo doctors removed (see 014_remove_seed_demo_doctors.sql). Directory uses Marham ingest.
