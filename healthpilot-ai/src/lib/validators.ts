import { z } from 'zod'

export const pakistaniPhoneSchema = z
  .string()
  .regex(/^(\+92|0)?3[0-9]{9}$/, 'Enter a valid Pakistani phone number (e.g. 03001234567)')
  .transform((val) => (val.startsWith('0') ? '+92' + val.slice(1) : val))

export const signUpSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Name is required'),
  phone: pakistaniPhoneSchema,
  city: z.string().min(1, 'City is required'),
})

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const onboardingSchema = z.object({
  city: z.string().min(1, 'City is required'),
  area: z.string().optional(),
  age: z.number().min(1).max(120).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  preferredLanguage: z.enum(['en', 'ur']),
})

export type SignUpFormData = z.infer<typeof signUpSchema>
export type LoginFormData = z.infer<typeof loginSchema>
export type OnboardingFormData = z.infer<typeof onboardingSchema>
