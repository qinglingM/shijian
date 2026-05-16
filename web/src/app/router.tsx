import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { HomePage } from '@/pages/HomePage'
import { PracticeStep1Page } from '@/pages/practice/PracticeStep1Page'
import { PracticeStep2Page } from '@/pages/practice/PracticeStep2Page'
import { PracticeStep3Page } from '@/pages/practice/PracticeStep3Page'
import { PracticeManualPage } from '@/pages/practice/PracticeManualPage'
import { PracticeDonePage } from '@/pages/practice/PracticeDonePage'
import { RestaurantDetailPage } from '@/pages/RestaurantDetailPage'
import { TierBucketPage } from '@/pages/TierBucketPage'
import { DishDetailPage } from '@/pages/DishDetailPage'
import { MePage } from '@/pages/MePage'
import { MarksPage } from '@/pages/MarksPage'
import { BolePage } from '@/pages/BolePage'
import { SearchRestaurantsPage } from '@/pages/SearchRestaurantsPage'
import { PracticeMapPage } from '@/pages/PracticeMapPage'
import { AuthPage } from '@/pages/AuthPage'
import { MeProfileEditPage } from '@/pages/MeProfileEditPage'
import { LegalDocPage } from '@/pages/LegalDocPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/legal/:slug" element={<LegalDocPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchRestaurantsPage />} />
        <Route path="/map" element={<PracticeMapPage />} />
        <Route
          path="/practice/step1"
          element={
            <RequireAuth>
              <PracticeStep1Page />
            </RequireAuth>
          }
        />
        <Route
          path="/practice/step2"
          element={
            <RequireAuth>
              <PracticeStep2Page />
            </RequireAuth>
          }
        />
        <Route
          path="/practice/step3"
          element={
            <RequireAuth>
              <PracticeStep3Page />
            </RequireAuth>
          }
        />
        <Route
          path="/practice/manual"
          element={
            <RequireAuth>
              <PracticeManualPage />
            </RequireAuth>
          }
        />
        <Route
          path="/practice/done"
          element={
            <RequireAuth>
              <PracticeDonePage />
            </RequireAuth>
          }
        />
        <Route path="/tiers/:tier" element={<TierBucketPage />} />
        <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
        <Route path="/dishes/:id" element={<DishDetailPage />} />
        <Route path="/me" element={<MePage />} />
        <Route
          path="/me/edit"
          element={
            <RequireAuth>
              <MeProfileEditPage />
            </RequireAuth>
          }
        />
        <Route path="/me/marks" element={<MarksPage />} />
        <Route path="/me/bole" element={<BolePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
