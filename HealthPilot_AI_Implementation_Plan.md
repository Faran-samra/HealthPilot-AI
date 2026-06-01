# HealthPilot AI — Complete Implementation Plan
### Your AI Healthcare Navigation & Doctor Recommendation Assistant (Pakistan Edition)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Database Schema (Supabase)](#database-schema-supabase)
5. [Phase 1 — Project Setup & Foundation](#phase-1--project-setup--foundation)
6. [Phase 2 — Authentication & User Profiles](#phase-2--authentication--user-profiles)
7. [Phase 3 — Symptom Checker & AI Engine](#phase-3--symptom-checker--ai-engine)
8. [Phase 4 — Doctor Discovery & Maps](#phase-4--doctor-discovery--maps)
9. [Phase 5 — Appointment Booking System](#phase-5--appointment-booking-system)
10. [Phase 6 — Pakistan-Specific Features](#phase-6--pakistan-specific-features)
11. [Phase 7 — Dashboard & Notifications](#phase-7--dashboard--notifications)
12. [Phase 8 — Testing, Deployment & Launch](#phase-8--testing-deployment--launch)
13. [Folder Structure](#folder-structure)
14. [Environment Variables](#environment-variables)
15. [API Reference Summary](#api-reference-summary)
16. [Pakistan-Specific Considerations](#pakistan-specific-considerations)
17. [Timeline Estimate](#timeline-estimate)

---

## Project Overview

HealthPilot AI solves the core problem faced by millions of Pakistanis:

> *"I have symptoms but I don't know which doctor to visit or where to go."*

The system bridges this gap by:
- Using AI to analyze symptoms in English **and Urdu**
- Mapping symptoms to the correct medical specialty
- Locating verified doctors and clinics in Pakistani cities
- Enabling instant appointment booking via phone/WhatsApp or in-app

**Target Cities (Phase 1):** Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast, type-safe, component-driven |
| Styling | Tailwind CSS + shadcn/ui | Rapid, consistent UI |
| State Management | Zustand | Lightweight, simple |
| Backend / DB | Supabase | Auth + PostgreSQL + Realtime + Storage |
| AI Engine | Anthropic Claude API (claude-sonnet-4) | Symptom analysis + chat |
| Maps | Google Maps JS API | Pakistan coverage |
| Geolocation | Browser Geolocation API + Google Geocoding | City/area detection |
| SMS/WhatsApp | Twilio (or local: Jazz/Telenor API) | Pakistan phone notifications |
| Email | Supabase built-in (or Resend) | Appointment confirmations |
| Hosting | Vercel (frontend) + Supabase (backend) | Free tier available |
| Payments (Phase 2) | JazzCash / EasyPaisa API | Pakistani payment gateways |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React / TypeScript                   │
│   ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │ Symptom  │  │   Doctor     │  │   Appointment    │  │
│   │ Checker  │  │   Finder     │  │   Booking        │  │
│   └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
└────────┼───────────────┼────────────────────┼────────────┘
         │               │                    │
         ▼               ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase (Backend as a Service)             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │  Auth   │  │ Database │  │ Edge Fn  │  │ Storage │  │
│  │ (JWT)   │  │(Postgres)│  │ (Claude) │  │(Avatars)│  │
│  └─────────┘  └──────────┘  └──────────┘  └─────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌──────────────────┐     ┌──────────────────────┐
    │  Anthropic API   │     │  Google Maps API     │
    │  (Claude Sonnet) │     │  (Places + Geocode)  │
    └──────────────────┘     └──────────────────────┘
```

---

## Database Schema (Supabase)

### Table: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  phone TEXT,           -- Pakistani format: +923001234567
  city TEXT,
  area TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'ur')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `doctors`
```sql
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL,           -- e.g., 'Cardiologist', 'General Physician'
  specialty_slug TEXT NOT NULL,      -- e.g., 'cardiology', 'general'
  qualification TEXT,                -- e.g., 'MBBS, FCPS'
  experience_years INTEGER,
  hospital_name TEXT,
  address TEXT,
  city TEXT NOT NULL,                -- 'Lahore', 'Karachi', etc.
  area TEXT,                         -- 'DHA', 'Gulberg', etc.
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  whatsapp TEXT,
  consultation_fee INTEGER,          -- in PKR
  available_days TEXT[],             -- ['Monday','Tuesday',...]
  available_times JSONB,             -- {"start": "09:00", "end": "17:00"}
  languages TEXT[] DEFAULT ARRAY['Urdu','English'],
  rating DECIMAL(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  profile_image_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  pmdc_number TEXT,                  -- Pakistan Medical & Dental Council number
  accepts_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial index for nearby search
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE doctors ADD COLUMN location GEOGRAPHY(POINT, 4326);
CREATE INDEX doctors_location_idx ON doctors USING GIST(location);
```

### Table: `symptom_sessions`
```sql
CREATE TABLE symptom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symptoms_reported TEXT[],
  ai_analysis JSONB,                 -- full Claude response
  suggested_specialty TEXT,
  suggested_specialty_slug TEXT,
  severity_level TEXT CHECK (severity_level IN ('mild', 'moderate', 'severe', 'emergency')),
  language_used TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `appointments`
```sql
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
  consultation_fee INTEGER,          -- in PKR
  payment_status TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `reviews`
```sql
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
```

### Table: `specialties`
```sql
CREATE TABLE specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  name_urdu TEXT,
  icon TEXT,                         -- Lucide icon name
  description TEXT,
  common_symptoms TEXT[]
);

-- Seed data
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
```

### Row Level Security (RLS) Policies
```sql
-- Profiles: users see only their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Appointments: patients see their own
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own appointments" ON appointments
  FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients insert own appointments" ON appointments
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Doctors: public read, admin write
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active doctors" ON doctors
  FOR SELECT USING (is_active = TRUE);
```

---

## Phase 1 — Project Setup & Foundation

**Goal:** Scaffold the project, configure tools, connect to Supabase.

**Duration:** 3–4 days

### 1.1 Initialize Project
```bash
npm create vite@latest healthpilot-ai -- --template react-ts
cd healthpilot-ai
npm install
```

### 1.2 Install Dependencies
```bash
# UI & Styling
npm install tailwindcss @tailwindcss/vite
npm install @radix-ui/react-dialog @radix-ui/react-select
npm install lucide-react clsx tailwind-merge

# shadcn/ui (run for each component)
npx shadcn@latest init
npx shadcn@latest add button input card badge dialog select toast

# Supabase
npm install @supabase/supabase-js

# State & Forms
npm install zustand react-hook-form @hookform/resolvers zod

# Routing
npm install react-router-dom

# Maps
npm install @react-google-maps/api

# Utils
npm install date-fns axios
```

### 1.3 Supabase Setup
- Create project at supabase.com
- Run all schema SQL from the Database Schema section above
- Enable Email + Phone auth providers
- Enable Google OAuth (optional)
- Configure Storage bucket: `avatars` (public), `doctor-images` (public)

### 1.4 Configure Supabase Client
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

### 1.5 Generate TypeScript Types
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

### Deliverables
- Vite + React + TypeScript project running
- Supabase connected and schema deployed
- Environment variables configured
- Tailwind + shadcn/ui working

---

## Phase 2 — Authentication & User Profiles

**Goal:** Secure login, registration, onboarding with Pakistani context.

**Duration:** 4–5 days

### 2.1 Pages to Build
- `/` — Landing page (hero, features, how it works)
- `/login` — Email/phone login
- `/register` — Registration with Pakistani phone format
- `/onboarding` — City selection, age, language preference
- `/profile` — Edit profile

### 2.2 Auth Flow
```typescript
// src/store/authStore.ts
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface AuthStore {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (data: SignUpData) => Promise<void>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await get().loadProfile()
  },

  signUp: async ({ email, password, fullName, phone, city }) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    await supabase.from('profiles').insert({
      id: data.user!.id,
      full_name: fullName,
      phone,
      city
    })
  },

  loadProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return set({ user: null, profile: null })
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    set({ user, profile })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  }
}))
```

### 2.3 Pakistani Phone Validation
```typescript
// src/lib/validators.ts
import { z } from 'zod'

export const pakistaniPhoneSchema = z
  .string()
  .regex(/^(\+92|0)?3[0-9]{9}$/, 'Enter a valid Pakistani phone number (e.g. 03001234567)')
  .transform(val => val.startsWith('0') ? '+92' + val.slice(1) : val)
```

### 2.4 Onboarding — City Selection Component
```typescript
// Major Pakistani cities with their districts
export const PAKISTAN_CITIES = [
  { value: 'lahore', label: 'Lahore', province: 'Punjab' },
  { value: 'karachi', label: 'Karachi', province: 'Sindh' },
  { value: 'islamabad', label: 'Islamabad', province: 'Federal' },
  { value: 'rawalpindi', label: 'Rawalpindi', province: 'Punjab' },
  { value: 'faisalabad', label: 'Faisalabad', province: 'Punjab' },
  { value: 'multan', label: 'Multan', province: 'Punjab' },
  { value: 'peshawar', label: 'Peshawar', province: 'KPK' },
  { value: 'quetta', label: 'Quetta', province: 'Balochistan' },
  { value: 'hyderabad', label: 'Hyderabad', province: 'Sindh' },
  { value: 'sialkot', label: 'Sialkot', province: 'Punjab' },
]
```

### Deliverables
- Login, Register, Onboarding, Profile pages
- Supabase Auth working (email + phone)
- Protected routes with auth guard
- Pakistani phone validation
- City/area selection

---

## Phase 3 — Symptom Checker & AI Engine

**Goal:** The core AI feature — symptom input, Claude analysis, specialty recommendation.

**Duration:** 6–7 days

### 3.1 Supabase Edge Function — AI Symptom Analysis

Create at `supabase/functions/analyze-symptoms/index.ts`:

```typescript
import Anthropic from "npm:@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

const SYSTEM_PROMPT = `You are HealthPilot AI, a medical symptom analysis assistant designed for Pakistani users.

Your job:
1. Analyze the user's described symptoms
2. Suggest possible (not definitive) health concerns
3. Recommend the most relevant medical specialist
4. Assess severity level
5. Provide first-aid advice if applicable
6. If symptoms suggest emergency (heart attack, stroke, severe breathing difficulty), strongly advise immediate ER visit

IMPORTANT RULES:
- Always clarify you are NOT providing a final medical diagnosis
- Be empathetic and culturally sensitive for Pakistani users
- Mention that results are AI-suggested, not doctor advice
- For emergencies, provide emergency numbers: Rescue 1122 (Punjab), Edhi 115, Chippa 1020

Respond in JSON with this exact structure:
{
  "possible_conditions": ["condition1", "condition2"],
  "recommended_specialty": "Specialty Name",
  "recommended_specialty_slug": "slug",
  "severity_level": "mild|moderate|severe|emergency",
  "explanation": "Clear explanation in simple language",
  "first_aid_tips": ["tip1", "tip2"],
  "red_flags": ["symptom that means go to ER immediately"],
  "disclaimer": "Standard medical disclaimer",
  "urdu_summary": "مختصر خلاصہ اردو میں"
}`

Deno.serve(async (req) => {
  const { symptoms, language, userAge, userGender } = await req.json()

  const userPrompt = language === 'ur'
    ? `میرے علامات: ${symptoms}. میری عمر: ${userAge}. جنس: ${userGender}`
    : `My symptoms: ${symptoms}. Age: ${userAge}. Gender: ${userGender}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const result = JSON.parse(text)

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Deploy with:
```bash
supabase functions deploy analyze-symptoms
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### 3.2 Symptom Checker UI Flow

**Step 1 — Symptom Input Page** (`/symptom-checker`)
- Large text area: "Describe how you feel..."
- Language toggle: English / اردو
- Quick symptom chips (Fever, Headache, Cough, Chest Pain, etc.)
- Auto-translate Urdu input before sending to AI

**Step 2 — Analysis Loading**
- Animated health icon with "Analyzing your symptoms..."
- Estimated wait: 3–5 seconds

**Step 3 — Results Page**
```typescript
interface AIAnalysisResult {
  possible_conditions: string[]
  recommended_specialty: string
  recommended_specialty_slug: string
  severity_level: 'mild' | 'moderate' | 'severe' | 'emergency'
  explanation: string
  first_aid_tips: string[]
  red_flags: string[]
  disclaimer: string
  urdu_summary: string
}
```

Result page shows:
- Severity badge (color-coded: green/yellow/orange/red)
- Possible health concerns (with disclaimer)
- Recommended specialist
- First-aid tips
- Emergency warning (if applicable)
- CTA button: "Find [Specialist] Near Me →"

### 3.3 Severity Color System
```typescript
export const SEVERITY_CONFIG = {
  mild: { color: 'green', label: 'Mild', icon: 'CheckCircle', bg: 'bg-green-50' },
  moderate: { color: 'yellow', label: 'Moderate', icon: 'AlertCircle', bg: 'bg-yellow-50' },
  severe: { color: 'orange', label: 'Severe', icon: 'AlertTriangle', bg: 'bg-orange-50' },
  emergency: { color: 'red', label: 'Emergency — Go to ER Now', icon: 'Siren', bg: 'bg-red-50' }
}
```

### 3.4 Save Session to Supabase
```typescript
// After AI analysis completes
const { data: session } = await supabase
  .from('symptom_sessions')
  .insert({
    user_id: user.id,
    symptoms_reported: symptomsArray,
    ai_analysis: analysisResult,
    suggested_specialty: analysisResult.recommended_specialty,
    suggested_specialty_slug: analysisResult.recommended_specialty_slug,
    severity_level: analysisResult.severity_level,
    language_used: selectedLanguage
  })
  .select()
  .single()
```

### Deliverables
- Symptom checker with English/Urdu input
- Supabase Edge Function calling Claude API
- AI results with severity, specialty, tips
- Emergency warning system (Pakistani emergency numbers)
- Session saved to Supabase

---

## Phase 4 — Doctor Discovery & Maps

**Goal:** Find nearby verified doctors based on AI-recommended specialty.

**Duration:** 5–6 days

### 4.1 Doctor Search Service
```typescript
// src/services/doctorService.ts
import { supabase } from '@/lib/supabase'

export async function findNearbyDoctors({
  specialty,
  city,
  latitude,
  longitude,
  radiusKm = 10,
  maxFee
}: DoctorSearchParams) {
  let query = supabase
    .from('doctors')
    .select('*')
    .eq('specialty_slug', specialty)
    .eq('city', city)
    .eq('is_active', true)
    .order('rating', { ascending: false })

  if (maxFee) query = query.lte('consultation_fee', maxFee)

  // If lat/lng available, use PostGIS distance query
  if (latitude && longitude) {
    const { data } = await supabase.rpc('doctors_within_radius', {
      lat: latitude,
      lng: longitude,
      radius_km: radiusKm,
      specialty_filter: specialty
    })
    return data
  }

  const { data, error } = await query.limit(20)
  if (error) throw error
  return data
}
```

### 4.2 PostGIS RPC Function
```sql
-- supabase/migrations/nearby_doctors.sql
CREATE OR REPLACE FUNCTION doctors_within_radius(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  specialty_filter TEXT
)
RETURNS TABLE (
  id UUID, full_name TEXT, specialty TEXT, hospital_name TEXT,
  address TEXT, city TEXT, area TEXT, rating DECIMAL,
  consultation_fee INTEGER, phone TEXT, whatsapp TEXT,
  distance_km DOUBLE PRECISION, profile_image_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.full_name, d.specialty, d.hospital_name,
    d.address, d.city, d.area, d.rating,
    d.consultation_fee, d.phone, d.whatsapp,
    ROUND((ST_Distance(d.location, ST_MakePoint(lng, lat)::GEOGRAPHY) / 1000)::NUMERIC, 2)::DOUBLE PRECISION,
    d.profile_image_url
  FROM doctors d
  WHERE
    d.is_active = TRUE
    AND (specialty_filter IS NULL OR d.specialty_slug = specialty_filter)
    AND ST_DWithin(d.location, ST_MakePoint(lng, lat)::GEOGRAPHY, radius_km * 1000)
  ORDER BY distance_km ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 Doctor List Page (`/doctors`)
Features:
- Filter bar: City, Specialty, Max Fee (PKR), Available Today
- Doctor cards with: photo, name, qualification, hospital, rating, fee, distance
- Sort by: Rating, Distance, Fee (Low to High)
- Map view toggle (Google Maps)
- "Book Appointment" and "WhatsApp" buttons

### 4.4 Doctor Card Component
```typescript
// src/components/DoctorCard.tsx
interface DoctorCardProps {
  doctor: Doctor
  distanceKm?: number
  onBook: () => void
}

// Card shows:
// - Profile photo (or placeholder avatar)
// - Name + qualification (e.g., "Dr. Ahmed Ali — MBBS, FCPS")
// - Specialty badge
// - Hospital name + area
// - ⭐ Rating (4.7) + review count
// - 💰 Fee: PKR 1,200
// - 📍 Distance: 2.3 km away
// - ✅ PMDC Verified badge
// - 📅 Available: Mon–Fri
// - Buttons: Book Now | WhatsApp | Call
```

### 4.5 Google Maps Integration
```typescript
// src/components/DoctorsMap.tsx
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api'

// Map centered on user's city (e.g., Lahore: 31.5204, 74.3587)
const CITY_CENTERS = {
  lahore: { lat: 31.5204, lng: 74.3587 },
  karachi: { lat: 24.8607, lng: 67.0011 },
  islamabad: { lat: 33.6844, lng: 73.0479 },
  rawalpindi: { lat: 33.5651, lng: 73.0169 },
}
```

### 4.6 Doctor Detail Page (`/doctors/:id`)
- Full profile: bio, qualifications, years of experience
- Photo gallery of clinic
- Patient reviews
- Availability calendar (weekly slots)
- Location on map with directions link
- Contact options: In-App Book / WhatsApp / Call

### Deliverables
- Doctor search with specialty + city filters
- PostGIS-powered nearby search
- Google Maps with doctor pins
- Doctor profile pages
- WhatsApp and phone call deep links

---

## Phase 5 — Appointment Booking System

**Goal:** Allow patients to book appointments in-app or via WhatsApp.

**Duration:** 5–6 days

### 5.1 Booking Flow
```
Patient selects doctor
       ↓
Choose date (from doctor's available days)
       ↓
Choose time slot
       ↓
Add notes / symptoms summary
       ↓
Confirm booking
       ↓
SMS/WhatsApp confirmation sent
       ↓
Appointment in dashboard
```

### 5.2 Availability Slot Generator
```typescript
// src/utils/appointmentUtils.ts
export function generateTimeSlots(
  startTime: string,  // "09:00"
  endTime: string,    // "17:00"
  durationMinutes = 30,
  bookedSlots: string[]
): TimeSlot[] {
  const slots: TimeSlot[] = []
  let current = parseTime(startTime)
  const end = parseTime(endTime)

  while (current < end) {
    const timeStr = formatTime(current)
    slots.push({
      time: timeStr,
      isAvailable: !bookedSlots.includes(timeStr)
    })
    current += durationMinutes
  }
  return slots
}
```

### 5.3 Booking Service
```typescript
// src/services/bookingService.ts
export async function createAppointment(data: CreateAppointmentInput) {
  // 1. Check slot is still available
  const isAvailable = await checkSlotAvailability(
    data.doctorId, data.date, data.time
  )
  if (!isAvailable) throw new Error('Slot no longer available')

  // 2. Create appointment in Supabase
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: data.patientId,
      doctor_id: data.doctorId,
      session_id: data.sessionId,
      appointment_date: data.date,
      appointment_time: data.time,
      patient_notes: data.notes,
      consultation_fee: data.fee,
      booking_method: 'in_app',
      status: 'pending'
    })
    .select()
    .single()

  if (error) throw error

  // 3. Trigger confirmation (Edge Function sends SMS/WhatsApp)
  await sendBookingConfirmation(appointment)

  return appointment
}
```

### 5.4 WhatsApp Booking (Pakistani Preference)
```typescript
// Many Pakistani patients prefer WhatsApp — direct deep link
export function getWhatsAppBookingLink(doctor: Doctor, appointmentDetails?: string) {
  const number = doctor.whatsapp.replace(/\D/g, '')
  const message = encodeURIComponent(
    `Assalam o Alaikum, I would like to book an appointment.\n` +
    `Name: ${patientName}\n` +
    `Symptoms: ${symptoms}\n` +
    `Preferred Date: ${preferredDate}`
  )
  return `https://wa.me/${number}?text=${message}`
}
```

### 5.5 Booking Confirmation Edge Function
```typescript
// supabase/functions/send-confirmation/index.ts
// Sends WhatsApp/SMS via Twilio (or Jazz API for Pakistan)
// Message includes: doctor name, date, time, clinic address, fee
```

### 5.6 Appointment Management Page (`/appointments`)
- Upcoming appointments (with countdown)
- Past appointments (with review prompt)
- Cancel appointment button (with 24-hour policy)
- Add to phone calendar button

### Deliverables
- Date + time slot picker
- Appointment creation in Supabase
- WhatsApp booking deep link
- Booking confirmation notifications
- Appointment list with status management

---

## Phase 6 — Pakistan-Specific Features

**Goal:** Features built specifically for Pakistani users and the local healthcare context.

**Duration:** 4–5 days

### 6.1 Urdu Language Support
```typescript
// src/i18n/urdu.ts
export const ur = {
  hero: {
    title: 'اپنی صحت کا خیال رکھیں',
    subtitle: 'علامات بیان کریں، صحیح ڈاکٹر تک پہنچیں',
    cta: 'علامات چیک کریں'
  },
  symptoms: {
    placeholder: 'اپنی تکلیف بیان کریں...',
    analyze: 'تجزیہ کریں'
  },
  // ... full translation map
}

// Use react-i18next for switching
```

### 6.2 Emergency Numbers Widget
```typescript
// Floating emergency button visible everywhere
const PAKISTAN_EMERGENCY = {
  rescue: { number: '1122', label: 'Rescue (Punjab)', icon: '🚑' },
  edhi: { number: '115', label: 'Edhi Foundation', icon: '🏥' },
  chippa: { number: '1020', label: 'Chippa (Sindh)', icon: '🚒' },
  police: { number: '15', label: 'Police', icon: '🚔' },
  aman: { number: '1102', label: 'Aman (Karachi)', icon: '🆘' },
}
```

### 6.3 Fee Range Filters (Pakistani Context)
```typescript
// Typical consultation fees in Pakistan
export const FEE_RANGES = [
  { label: 'Budget (under PKR 500)', max: 500 },
  { label: 'Standard (PKR 500–1,500)', min: 500, max: 1500 },
  { label: 'Premium (PKR 1,500–3,000)', min: 1500, max: 3000 },
  { label: 'Specialist (PKR 3,000+)', min: 3000 },
]
```

### 6.4 PMDC Verification Badge
- Each doctor shows PMDC (Pakistan Medical & Dental Council) license status
- Link to verify at pmdc.org.pk
- "Verified Doctor" badge in search results

### 6.5 Gender-Sensitive Doctor Filtering
- Female patients can filter for female doctors (culturally important)
- "Female Doctor Only" toggle in filter bar
- Female doctor tag on cards

### 6.6 City-Specific Famous Hospitals
```typescript
export const FAMOUS_HOSPITALS = {
  lahore: ['Mayo Hospital', 'Services Hospital', 'Jinnah Hospital', 'Shaukat Khanum', 'Doctors Hospital'],
  karachi: ['Aga Khan Hospital', 'Jinnah Hospital', 'SIUT', 'Liaquat National', 'South City'],
  islamabad: ['PIMS', 'Shifa International', 'Ali Medical', 'Maroof International'],
  rawalpindi: ['Holy Family Hospital', 'Benazir Bhutto Hospital', 'CMH Rawalpindi'],
}
```

### 6.7 Telemedicine Option
- "Online Consultation" badge for doctors offering video/WhatsApp calls
- Especially useful for rural users and women at home
- Direct WhatsApp video link

### 6.8 Health Awareness Content (Pakistan-Specific)
Common conditions section:
- Dengue Fever (seasonal, endemic)
- Typhoid (water-borne)
- Hepatitis B & C (high prevalence in Pakistan)
- Diabetes (rapidly increasing)
- Hypertension
- Malaria (in certain regions)

### Deliverables
- Urdu language toggle across all pages
- Emergency services widget (city-specific)
- PKR fee ranges and filters
- PMDC verification badges
- Female doctor filter
- Hospital-based search

---

## Phase 7 — Dashboard & Notifications

**Goal:** Personalized user dashboard, health history, reminders.

**Duration:** 3–4 days

### 7.1 Patient Dashboard (`/dashboard`)

Sections:
- **Quick Action:** "Check Symptoms" CTA
- **Upcoming Appointments:** Next 3 with countdown
- **Past Sessions:** Symptom check history with AI results
- **Health Summary:** Stats (total consultations, most visited specialty)
- **Recommended Checkups:** Based on age/gender (e.g., eye test for 40+, diabetes for 30+)

### 7.2 Notifications System

```typescript
// Supabase Realtime for live appointment updates
const subscription = supabase
  .channel('appointments')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'appointments',
    filter: `patient_id=eq.${userId}`
  }, (payload) => {
    if (payload.new.status === 'confirmed') {
      toast.success('Your appointment has been confirmed!')
    }
  })
  .subscribe()
```

### 7.3 Review System
- After appointment completion, prompt patient for 1–5 star review
- Anonymous review option
- Reviews shown on doctor profile
- Auto-update doctor rating in `doctors` table

### 7.4 Supabase Database Trigger (Auto-Update Rating)
```sql
CREATE OR REPLACE FUNCTION update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE doctors
  SET
    rating = (SELECT AVG(rating) FROM reviews WHERE doctor_id = NEW.doctor_id),
    total_reviews = (SELECT COUNT(*) FROM reviews WHERE doctor_id = NEW.doctor_id)
  WHERE id = NEW.doctor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_doctor_rating();
```

### Deliverables
- Patient dashboard with stats
- Real-time appointment status via Supabase
- Star rating and review system
- Notification toast system

---

## Phase 8 — Testing, Deployment & Launch

**Goal:** QA, performance optimization, and production deployment.

**Duration:** 5–7 days

### 8.1 Testing Strategy
```bash
# Unit tests
npm install -D vitest @testing-library/react @testing-library/jest-dom

# E2E tests
npm install -D playwright
```

Key test cases:
- Symptom analysis returns valid JSON
- Doctor search returns correct city/specialty results
- Appointment booking prevents double-booking
- Auth guards protect private routes
- Pakistani phone numbers validate correctly
- Urdu text renders correctly

### 8.2 Performance Optimization
- Lazy load all route pages with `React.lazy()`
- Paginate doctor results (20 per page)
- Cache AI results in sessionStorage (avoid re-analyzing same symptoms)
- Optimize images with WebP format
- Use Supabase connection pooling

### 8.3 Mobile Responsiveness
Pakistan has 80%+ mobile internet usage. Every page must be:
- Mobile-first design (375px baseline)
- Touch-friendly buttons (min 44px tap targets)
- Fast on 3G/4G connections
- Urdu text right-to-left in dedicated Urdu mode

### 8.4 Deployment — Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_MAPS_API_KEY=
```

### 8.5 Supabase Production Checklist
- Enable RLS on ALL tables ✅
- Set up backup schedule (daily)
- Configure rate limiting on Edge Functions
- Enable Supabase Auth email templates (branded)
- Set up monitoring alerts

### 8.6 Legal & Compliance
- Medical disclaimer on every symptom result page
- Privacy policy (PDPA Pakistan compliance)
- Terms of service
- PMDC doctor verification process documented
- Data stored within Pakistan jurisdiction if required

### Deliverables
- Full test coverage for core flows
- Mobile-optimized for Pakistani users
- Production deployment on Vercel + Supabase
- Medical disclaimers and legal pages
- Performance score > 85 on Lighthouse

---

## Folder Structure

```
healthpilot-ai/
├── public/
│   └── locales/
│       ├── en.json
│       └── ur.json
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn components
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── EmergencyWidget.tsx
│   │   ├── symptom/
│   │   │   ├── SymptomInput.tsx
│   │   │   ├── SymptomChips.tsx
│   │   │   ├── AnalysisResult.tsx
│   │   │   └── SeverityBadge.tsx
│   │   ├── doctors/
│   │   │   ├── DoctorCard.tsx
│   │   │   ├── DoctorFilters.tsx
│   │   │   ├── DoctorsMap.tsx
│   │   │   └── DoctorProfile.tsx
│   │   └── appointments/
│   │       ├── BookingCalendar.tsx
│   │       ├── TimeSlotPicker.tsx
│   │       └── AppointmentCard.tsx
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Onboarding.tsx
│   │   ├── Dashboard.tsx
│   │   ├── SymptomChecker.tsx
│   │   ├── AnalysisResult.tsx
│   │   ├── DoctorSearch.tsx
│   │   ├── DoctorDetail.tsx
│   │   ├── BookAppointment.tsx
│   │   ├── Appointments.tsx
│   │   └── Profile.tsx
│   ├── services/
│   │   ├── doctorService.ts
│   │   ├── bookingService.ts
│   │   ├── symptomService.ts
│   │   └── notificationService.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── symptomStore.ts
│   │   └── doctorStore.ts
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   ├── useSupabaseRealtime.ts
│   │   └── useDebounce.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── database.types.ts
│   │   └── validators.ts
│   ├── utils/
│   │   ├── appointmentUtils.ts
│   │   ├── formatters.ts        # PKR formatting, date formatting
│   │   └── constants.ts         # cities, specialties, emergency numbers
│   └── App.tsx
├── supabase/
│   ├── functions/
│   │   ├── analyze-symptoms/
│   │   └── send-confirmation/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_specialties_seed.sql
│       └── 003_postgis_functions.sql
└── .env.local
```

---

## Environment Variables

```env
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

VITE_GOOGLE_MAPS_API_KEY=AIza...

# Supabase Edge Function secrets (set via CLI)
# supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# supabase secrets set TWILIO_ACCOUNT_SID=...
# supabase secrets set TWILIO_AUTH_TOKEN=...
# supabase secrets set TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

---

## API Reference Summary

| Endpoint | Method | Description |
|---|---|---|
| `supabase.auth.signUp()` | — | Register new patient |
| `supabase.auth.signInWithPassword()` | — | Patient login |
| `supabase/functions/analyze-symptoms` | POST | AI symptom analysis |
| `supabase.from('doctors').select()` | GET | Fetch doctors with filters |
| `supabase.rpc('doctors_within_radius')` | POST | Nearby doctors via PostGIS |
| `supabase.from('appointments').insert()` | POST | Book appointment |
| `supabase/functions/send-confirmation` | POST | Send WhatsApp/SMS confirmation |
| `supabase.from('reviews').insert()` | POST | Submit doctor review |

---

## Pakistan-Specific Considerations

### Healthcare Context
- Most doctors accept walk-ins; online booking is still new — WhatsApp is the bridge
- Fees are significantly lower than Western countries (PKR 500–5,000 range)
- Urdu is essential for mass adoption beyond major cities
- Female doctors are a priority filter for women patients
- Rural users may have poor internet — optimize for slow connections
- PMDC registration is the trust signal patients look for

### Technology Context
- 80%+ of users will be on mobile (Android primarily)
- WhatsApp is used by 70%+ of the population — integrate deeply
- Jazz Cash / EasyPaisa are the preferred payment methods
- Many users have limited English literacy — Urdu UI is critical
- Google Maps coverage is good for major cities

### Data Privacy
- Store minimal health data
- Make all health data deletable
- Disclaimer that AI analysis is NOT a medical diagnosis
- Comply with Pakistani data protection norms

---

## Timeline Estimate

| Phase | Description | Duration |
|---|---|---|
| Phase 1 | Project Setup & Foundation | 3–4 days |
| Phase 2 | Authentication & User Profiles | 4–5 days |
| Phase 3 | Symptom Checker & AI Engine | 6–7 days |
| Phase 4 | Doctor Discovery & Maps | 5–6 days |
| Phase 5 | Appointment Booking System | 5–6 days |
| Phase 6 | Pakistan-Specific Features | 4–5 days |
| Phase 7 | Dashboard & Notifications | 3–4 days |
| Phase 8 | Testing, Deployment & Launch | 5–7 days |
| **Total** | **MVP Launch Ready** | **~7–8 weeks** |

### Recommended Build Order for Solo Developer
Work in this priority if time is limited:

1. Auth + Profiles (foundation)
2. Symptom Checker (core value proposition)
3. Doctor Search (core value proposition)
4. Appointment Booking (monetization path)
5. Pakistan features (Urdu, emergency, PMDC)
6. Dashboard + Reviews (retention)
7. Polish + Deploy

---

*HealthPilot AI Implementation Plan — Version 1.0*
*Prepared for Pakistani Healthcare Market*
*Stack: React + TypeScript + Supabase + Claude AI*
