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
  { value: 'gujranwala', label: 'Gujranwala', province: 'Punjab' },
  { value: 'abbottabad', label: 'Abbottabad', province: 'KPK' },
  { value: 'sargodha', label: 'Sargodha', province: 'Punjab' },
  { value: 'sukkur', label: 'Sukkur', province: 'Sindh' },
  { value: 'bahawalpur', label: 'Bahawalpur', province: 'Punjab' },
  { value: 'muzaffarabad', label: 'Muzaffarabad', province: 'AJK' },
  { value: 'gilgit', label: 'Gilgit', province: 'GB' },
  { value: 'mirpur', label: 'Mirpur (AJK)', province: 'AJK' },
] as const

export type PakistanCity = (typeof PAKISTAN_CITIES)[number]

/** All medical specialties — matches DB `specialties.slug` values. */
export const MEDICAL_SPECIALTIES = [
  { slug: 'general', label: 'General Physician' },
  { slug: 'cardiology', label: 'Cardiologist' },
  { slug: 'dermatology', label: 'Dermatologist' },
  { slug: 'orthopedics', label: 'Orthopedic' },
  { slug: 'gynecology', label: 'Gynecologist' },
  { slug: 'pediatrics', label: 'Pediatrician' },
  { slug: 'neurology', label: 'Neurologist' },
  { slug: 'ent', label: 'ENT Specialist' },
  { slug: 'ophthalmology', label: 'Ophthalmologist' },
  { slug: 'psychiatry', label: 'Psychiatrist' },
  { slug: 'urology', label: 'Urologist' },
  { slug: 'gastroenterology', label: 'Gastroenterologist' },
  { slug: 'endocrinology', label: 'Endocrinologist' },
  { slug: 'pulmonology', label: 'Pulmonologist' },
] as const

export const QUICK_SYMPTOMS = [
  'Fever',
  'Headache',
  'Cough',
  'Chest Pain',
  'Fatigue',
  'Nausea',
  'Back Pain',
  'Skin Rash',
  'Sore Throat',
  'Dizziness',
] as const

export const SEVERITY_CONFIG = {
  mild: { color: 'green', label: 'Mild', bg: 'bg-green-50 text-green-800 border-green-200' },
  moderate: { color: 'yellow', label: 'Moderate', bg: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  severe: { color: 'orange', label: 'Severe', bg: 'bg-orange-50 text-orange-800 border-orange-200' },
  emergency: {
    color: 'red',
    label: 'Emergency — Go to ER Now',
    bg: 'bg-red-50 text-red-800 border-red-200',
  },
} as const

export const PAKISTAN_EMERGENCY = {
  rescue: { number: '1122', label: 'Rescue (Punjab)', labelUr: 'ریسکیو (پنجاب)', icon: '🚑', cities: ['lahore', 'faisalabad', 'multan', 'sialkot', 'gujranwala', 'sargodha', 'bahawalpur'] },
  edhi: { number: '115', label: 'Edhi Foundation', labelUr: 'ادھی فاؤنڈیشن', icon: '🏥', cities: ['*'] },
  chippa: { number: '1020', label: 'Chippa (Sindh)', labelUr: 'چپا (سندھ)', icon: '🚒', cities: ['karachi', 'hyderabad', 'sukkur'] },
  police: { number: '15', label: 'Police', labelUr: 'پولیس', icon: '🚔', cities: ['*'] },
  aman: { number: '1102', label: 'Aman (Karachi)', labelUr: 'امان (کراچی)', icon: '🆘', cities: ['karachi'] },
  rescue1122_isb: { number: '1122', label: 'Rescue 1122 (Islamabad)', labelUr: 'ریسکیو 1122 (اسلام آباد)', icon: '🚑', cities: ['islamabad', 'rawalpindi'] },
  rescue1122_kpk: { number: '1122', label: 'Rescue 1122 (KPK)', labelUr: 'ریسکیو 1122 (KPK)', icon: '🚑', cities: ['peshawar', 'abbottabad'] },
  rescue1122_bal: { number: '1122', label: 'Rescue 1122 (Balochistan)', labelUr: 'ریسکیو 1122 (بلوچستان)', icon: '🚑', cities: ['quetta'] },
} as const

export type EmergencyServiceKey = keyof typeof PAKISTAN_EMERGENCY

export function getEmergencyServicesForCity(city?: string) {
  const cityKey = city?.toLowerCase() ?? 'lahore'
  return Object.entries(PAKISTAN_EMERGENCY)
    .filter(([, service]) => {
      const cities = service.cities as readonly string[]
      return cities.includes('*') || cities.includes(cityKey)
    })
    .map(([key, service]) => ({ key, ...service }))
}

export const FEE_RANGES = [
  { label: 'Budget (under PKR 500)', max: 500 },
  { label: 'Standard (PKR 500–1,500)', min: 500, max: 1500 },
  { label: 'Premium (PKR 1,500–3,000)', min: 1500, max: 3000 },
  { label: 'Specialist (PKR 3,000+)', min: 3000 },
] as const

/** City center coordinates for map fallback and radius search when GPS is unavailable. */
export const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  lahore: { lat: 31.5204, lng: 74.3587 },
  karachi: { lat: 24.8607, lng: 67.0011 },
  islamabad: { lat: 33.6844, lng: 73.0479 },
  rawalpindi: { lat: 33.5651, lng: 73.0169 },
  faisalabad: { lat: 31.418, lng: 73.079 },
  multan: { lat: 30.1575, lng: 71.5249 },
  peshawar: { lat: 34.0151, lng: 71.5249 },
  quetta: { lat: 30.1798, lng: 66.975 },
  hyderabad: { lat: 25.3924, lng: 68.3737 },
  sialkot: { lat: 32.4945, lng: 74.5229 },
  gujranwala: { lat: 32.1877, lng: 74.1945 },
  abbottabad: { lat: 34.1688, lng: 73.2215 },
  sargodha: { lat: 32.0836, lng: 72.6711 },
  sukkur: { lat: 27.7052, lng: 68.8574 },
  bahawalpur: { lat: 29.3956, lng: 71.6722 },
  muzaffarabad: { lat: 34.3700, lng: 73.4700 },
  gilgit: { lat: 35.9208, lng: 74.3144 },
  mirpur: { lat: 33.1484, lng: 73.7519 },
}

export const FAMOUS_HOSPITALS: Record<string, string[]> = {
  lahore: ['Mayo Hospital', 'Services Hospital', 'Jinnah Hospital', 'Shaukat Khanum', 'Doctors Hospital'],
  karachi: ['Aga Khan Hospital', 'Jinnah Hospital', 'SIUT', 'Liaquat National', 'South City'],
  islamabad: ['PIMS', 'Shifa International', 'Ali Medical', 'Maroof International'],
  rawalpindi: ['Holy Family Hospital', 'Benazir Bhutto Hospital', 'CMH Rawalpindi'],
  faisalabad: ['Allied Hospital', 'National Hospital', 'Madina Teaching Hospital'],
  multan: ['Nishtar Hospital', 'Mukhtar A. Sheikh Hospital', 'Children Complex'],
  peshawar: ['Lady Reading Hospital', 'Rehman Medical Institute', 'KTH'],
  quetta: ['Civil Hospital', 'Bolani Medical Complex', 'CMH Quetta'],
  hyderabad: ['Liaquat University Hospital', 'Bilawal Medical Centre', 'Civil Hospital'],
  sialkot: ['Allama Iqbal Memorial Hospital', 'Sialkot Medical Complex', 'CMH Sialkot'],
  gujranwala: ['DHQ Hospital', 'Faiz Hospital', 'Gondal Medical Complex'],
  abbottabad: ['Ayub Medical Complex', 'CMH Abbottabad'],
  sargodha: ['DHQ Hospital Sargodha', 'Umer Hospital'],
  sukkur: ['Civil Hospital Sukkur', 'Indus Hospital'],
  bahawalpur: ['Bahawal Victoria Hospital', 'CMH Bahawalpur'],
}

/** Default search radius tiers (km) for GPS-based discovery. */
export const SEARCH_RADIUS_KM = [15, 30, 50] as const

/** Max doctors for GPS radius / compact panels (symptom checker, etc.). */
export const DOCTOR_SEARCH_LIMIT = 50

/** Max doctors loaded for a full city directory listing (paginated fetch). */
export const DOCTOR_CITY_LISTING_MAX = 2000
