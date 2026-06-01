-- HealthPilot AI — Initial Schema
-- Run in Supabase SQL Editor or via supabase db push

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  city TEXT,
  area TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'ur')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  specialty_slug TEXT NOT NULL,
  qualification TEXT,
  experience_years INTEGER,
  hospital_name TEXT,
  address TEXT,
  city TEXT NOT NULL,
  area TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  whatsapp TEXT,
  consultation_fee INTEGER,
  available_days TEXT[],
  available_times JSONB,
  languages TEXT[] DEFAULT ARRAY['Urdu','English'],
  rating DECIMAL(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  profile_image_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  pmdc_number TEXT,
  accepts_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE symptom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symptoms_reported TEXT[],
  ai_analysis JSONB,
  suggested_specialty TEXT,
  suggested_specialty_slug TEXT,
  severity_level TEXT CHECK (severity_level IN ('mild', 'moderate', 'severe', 'emergency')),
  language_used TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  session_id UUID REFERENCES symptom_sessions(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  booking_method TEXT CHECK (booking_method IN ('in_app', 'whatsapp', 'phone')),
  patient_notes TEXT,
  doctor_notes TEXT,
  consultation_fee INTEGER,
  payment_status TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES profiles(id),
  doctor_id UUID REFERENCES doctors(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name_urdu TEXT,
  icon TEXT,
  description TEXT,
  common_symptoms TEXT[]
);

-- PostGIS for geospatial search
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE doctors ADD COLUMN location GEOGRAPHY(POINT, 4326);
CREATE INDEX doctors_location_idx ON doctors USING GIST(location);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own appointments" ON appointments
  FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients insert own appointments" ON appointments
  FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients update own appointments" ON appointments
  FOR UPDATE USING (auth.uid() = patient_id);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active doctors" ON doctors
  FOR SELECT USING (is_active = TRUE);

ALTER TABLE symptom_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sessions" ON symptom_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON symptom_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view specialties" ON specialties FOR SELECT USING (TRUE);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (TRUE);
CREATE POLICY "Patients insert own reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = patient_id);
