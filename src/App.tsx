import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/components/layout/MainLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Profile from '@/pages/Profile'
import SymptomChecker from '@/pages/SymptomChecker'
import AnalysisResult from '@/pages/AnalysisResult'
import FindDoctorsDirectory from '@/pages/FindDoctorsDirectory'
import HealthcareFacilities from '@/pages/HealthcareFacilities'
import DoctorDetail from '@/pages/DoctorDetail'
import PlaceDetail from '@/pages/PlaceDetail'
import BookAppointment from '@/pages/BookAppointment'
import Appointments from '@/pages/Appointments'
import HealthAwareness from '@/pages/HealthAwareness'
import HealthStatistics from '@/pages/HealthStatistics'

function AppRoutes() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="symptom-checker" element={<SymptomChecker />} />
        <Route path="symptom-checker/results" element={<AnalysisResult />} />
        <Route path="doctors" element={<FindDoctorsDirectory />} />
        <Route path="healthcare-facilities" element={<HealthcareFacilities />} />
        <Route path="doctors/:id" element={<DoctorDetail />} />
        <Route path="places/:id" element={<PlaceDetail />} />
        <Route path="health-info" element={<HealthAwareness />} />
        <Route path="health-statistics" element={<HealthStatistics />} />

        <Route
          path="onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="doctors/:id/book" element={<BookAppointment />} />
        <Route
          path="appointments"
          element={
            <ProtectedRoute>
              <Appointments />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
