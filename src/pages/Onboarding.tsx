import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { onboardingSchema, type OnboardingFormData } from '@/lib/validators'
import { useAuthStore } from '@/store/authStore'
import { PAKISTAN_CITIES } from '@/utils/constants'

export default function Onboarding() {
  const navigate = useNavigate()
  const { profile, updateProfile } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      city: profile?.city ?? 'lahore',
      area: profile?.area ?? '',
      age: profile?.age ?? undefined,
      gender: profile?.gender ?? undefined,
      preferredLanguage: profile?.preferred_language ?? 'en',
    },
  })

  const city = watch('city')
  const gender = watch('gender')
  const preferredLanguage = watch('preferredLanguage')

  const onSubmit = async (data: OnboardingFormData) => {
    setSubmitting(true)
    try {
      await updateProfile({
        city: data.city,
        area: data.area ?? null,
        age: data.age ?? null,
        gender: data.gender ?? null,
        preferred_language: data.preferredLanguage,
      })
      toast.success('Profile updated!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>
            Help us personalize your healthcare experience in Pakistan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Select value={city} onValueChange={(v) => setValue('city', v ?? 'lahore')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {PAKISTAN_CITIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Area / Neighborhood</Label>
              <Input id="area" placeholder="e.g. DHA, Gulberg, Clifton" {...register('area')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={1}
                max={120}
                {...register('age', { valueAsNumber: true })}
              />
              {errors.age && <p className="text-sm text-destructive">{errors.age.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={gender ?? ''}
                onValueChange={(v) =>
                  setValue('gender', v as 'male' | 'female' | 'other' | undefined)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preferred Language</Label>
              <Select
                value={preferredLanguage}
                onValueChange={(v) => setValue('preferredLanguage', (v as 'en' | 'ur') ?? 'en')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ur">اردو (Urdu)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving...' : 'Continue to Dashboard'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
