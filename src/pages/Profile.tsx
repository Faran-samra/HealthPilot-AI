import { useState } from 'react'
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
import { useAuthStore } from '@/store/authStore'
import { PAKISTAN_CITIES } from '@/utils/constants'

export default function Profile() {
  const { profile, updateProfile } = useAuthStore()
  const [submitting, setSubmitting] = useState(false)
  const [city, setCity] = useState(profile?.city ?? 'lahore')
  const [language, setLanguage] = useState(profile?.preferred_language ?? 'en')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)

    try {
      await updateProfile({
        full_name: formData.get('fullName') as string,
        phone: formData.get('phone') as string,
        city,
        area: (formData.get('area') as string) || null,
        age: Number(formData.get('age')) || null,
        preferred_language: language,
      })
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Manage your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={profile?.full_name ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={profile?.phone ?? ''} />
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Select value={city} onValueChange={(v) => setCity(v ?? 'lahore')}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label htmlFor="area">Area</Label>
              <Input id="area" name="area" defaultValue={profile?.area ?? ''} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                name="age"
                type="number"
                defaultValue={profile?.age ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label>Preferred Language</Label>
              <Select
                value={language}
                onValueChange={(v) => setLanguage((v as 'en' | 'ur') ?? 'en')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ur">Urdu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
