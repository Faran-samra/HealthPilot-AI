export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          city: string | null
          area: string | null
          age: number | null
          gender: 'male' | 'female' | 'other' | null
          preferred_language: 'en' | 'ur'
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          city?: string | null
          area?: string | null
          age?: number | null
          gender?: 'male' | 'female' | 'other' | null
          preferred_language?: 'en' | 'ur'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          phone?: string | null
          city?: string | null
          area?: string | null
          age?: number | null
          gender?: 'male' | 'female' | 'other' | null
          preferred_language?: 'en' | 'ur'
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          id: string
          full_name: string
          specialty: string
          specialty_slug: string
          qualification: string | null
          experience_years: number | null
          hospital_name: string | null
          address: string | null
          city: string
          city_slug: string | null
          province: string | null
          area: string | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          whatsapp: string | null
          consultation_fee: number | null
          available_days: string[] | null
          available_times: Json | null
          languages: string[] | null
          rating: number
          total_reviews: number
          profile_image_url: string | null
          is_verified: boolean
          is_active: boolean
          pmdc_number: string | null
          accepts_online: boolean
          gender: 'male' | 'female' | null
          created_at: string
        }
        Insert: {
          id?: string
          full_name: string
          specialty: string
          specialty_slug: string
          qualification?: string | null
          experience_years?: number | null
          hospital_name?: string | null
          address?: string | null
          city: string
          city_slug?: string | null
          province?: string | null
          area?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          whatsapp?: string | null
          consultation_fee?: number | null
          available_days?: string[] | null
          available_times?: Json | null
          languages?: string[] | null
          rating?: number
          total_reviews?: number
          profile_image_url?: string | null
          is_verified?: boolean
          is_active?: boolean
          pmdc_number?: string | null
          accepts_online?: boolean
          gender?: 'male' | 'female' | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          specialty?: string
          specialty_slug?: string
          qualification?: string | null
          experience_years?: number | null
          hospital_name?: string | null
          address?: string | null
          city?: string
          city_slug?: string | null
          province?: string | null
          area?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          whatsapp?: string | null
          consultation_fee?: number | null
          available_days?: string[] | null
          available_times?: Json | null
          languages?: string[] | null
          rating?: number
          total_reviews?: number
          profile_image_url?: string | null
          is_verified?: boolean
          is_active?: boolean
          pmdc_number?: string | null
          accepts_online?: boolean
          gender?: 'male' | 'female' | null
          created_at?: string
        }
        Relationships: []
      }
      symptom_sessions: {
        Row: {
          id: string
          user_id: string | null
          symptoms_reported: string[] | null
          ai_analysis: Json | null
          suggested_specialty: string | null
          suggested_specialty_slug: string | null
          severity_level: 'mild' | 'moderate' | 'severe' | 'emergency' | null
          language_used: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          symptoms_reported?: string[] | null
          ai_analysis?: Json | null
          suggested_specialty?: string | null
          suggested_specialty_slug?: string | null
          severity_level?: 'mild' | 'moderate' | 'severe' | 'emergency' | null
          language_used?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          symptoms_reported?: string[] | null
          ai_analysis?: Json | null
          suggested_specialty?: string | null
          suggested_specialty_slug?: string | null
          severity_level?: 'mild' | 'moderate' | 'severe' | 'emergency' | null
          language_used?: string
          created_at?: string
        }
        Relationships: []
      }
      analysis_feedback: {
        Row: {
          id: string
          session_id: string | null
          trace_id: string | null
          rating: number
          comment: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id?: string | null
          trace_id?: string | null
          rating: number
          comment?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string | null
          trace_id?: string | null
          rating?: number
          comment?: string | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          patient_id: string
          doctor_id: string
          session_id: string | null
          appointment_date: string
          appointment_time: string
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          booking_method: 'in_app' | 'whatsapp' | 'phone' | null
          patient_notes: string | null
          doctor_notes: string | null
          consultation_fee: number | null
          payment_status: 'unpaid' | 'paid' | 'refunded'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          doctor_id: string
          session_id?: string | null
          appointment_date: string
          appointment_time: string
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          booking_method?: 'in_app' | 'whatsapp' | 'phone' | null
          patient_notes?: string | null
          doctor_notes?: string | null
          consultation_fee?: number | null
          payment_status?: 'unpaid' | 'paid' | 'refunded'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          doctor_id?: string
          session_id?: string | null
          appointment_date?: string
          appointment_time?: string
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
          booking_method?: 'in_app' | 'whatsapp' | 'phone' | null
          patient_notes?: string | null
          doctor_notes?: string | null
          consultation_fee?: number | null
          payment_status?: 'unpaid' | 'paid' | 'refunded'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          appointment_id: string
          patient_id: string | null
          doctor_id: string | null
          rating: number
          comment: string | null
          is_anonymous: boolean
          created_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          patient_id?: string | null
          doctor_id?: string | null
          rating: number
          comment?: string | null
          is_anonymous?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          patient_id?: string | null
          doctor_id?: string | null
          rating?: number
          comment?: string | null
          is_anonymous?: boolean
          created_at?: string
        }
        Relationships: []
      }
      specialties: {
        Row: {
          id: string
          name: string
          slug: string
          name_urdu: string | null
          icon: string | null
          description: string | null
          common_symptoms: string[] | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          name_urdu?: string | null
          icon?: string | null
          description?: string | null
          common_symptoms?: string[] | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          name_urdu?: string | null
          icon?: string | null
          description?: string | null
          common_symptoms?: string[] | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      doctors_within_radius: {
        Args: {
          lat: number
          lng: number
          radius_km?: number
          specialty_filter?: string | null
          city_slug_filter?: string | null
          area_filter?: string | null
          result_limit?: number
        }
        Returns: Doctor[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Doctor = Database['public']['Tables']['doctors']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
export type SymptomSession = Database['public']['Tables']['symptom_sessions']['Row']
export type Specialty = Database['public']['Tables']['specialties']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']

export interface AIAnalysisResult {
  possible_conditions: string[]
  recommended_specialty: string
  recommended_specialty_slug: string
  severity_level: 'mild' | 'moderate' | 'severe' | 'emergency'
  explanation: string
  first_aid_tips: string[]
  red_flags: string[]
  disclaimer: string
  urdu_summary: string
  primary_condition?: string
  condition_confidence?: 'high' | 'medium' | 'low'
  brief_summary?: string
}
