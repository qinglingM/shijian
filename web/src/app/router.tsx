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
import { MeTitlesPage } from '@/pages/MeTitlesPage'
import { MeSettingsPage } from '@/pages/MeSettingsPage'
import { UserProfilePage } from '@/pages/UserProfilePage'
import { MarksPage } from '@/pages/MarksPage'
import { BolePage } from '@/pages/BolePage'
import { SearchRestaurantsPage } from '@/pages/SearchRestaurantsPage'
import { HomeMap } from '@/features/map/HomeMap'
import { SquarePage } from '@/pages/SquarePage'
import { SquarePublishPage } from '@/pages/square/SquarePublishPage'
import { PostDetailPage } from '@/pages/square/PostDetailPage'
import { AuthPage } from '@/pages/AuthPage'
import { MeProfileEditPage } from '@/pages/MeProfileEditPage'
import { LegalDocPage } from '@/pages/LegalDocPage'
import { SharePlaygroundPage } from '@/pages/SharePlaygroundPage'
import { PracticeRecordsPage } from '@/pages/PracticeRecordsPage'
export function AppRouter() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/legal/:slug" element={<LegalDocPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/tier-map" element={<HomePage />} />
        <Route path="/playground/share" element={<SharePlaygroundPage />} />
        <Route path="/search" element={<RequireAuth><SearchRestaurantsPage /></RequireAuth>} />
        <Route path="/map" element={<HomeMap />} />
        <Route path="/square" element={<SquarePage />} />
        <Route path="/square/post/:id" element={<PostDetailPage />} />
        <Route path="/square/publish" element={
          <RequireAuth>
            <SquarePublishPage />
          </RequireAuth>
        } />
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
        <Route path="/restaurants/poi/:source/:poiId" element={<RestaurantDetailPage />} />
        <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
        <Route path="/dishes/:id" element={<DishDetailPage />} />
        <Route path="/users/:slug" element={<UserProfilePage />} />
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
        <Route path="/me/titles" element={<RequireAuth><MeTitlesPage /></RequireAuth>} />
        <Route path="/me/practices" element={<RequireAuth><PracticeRecordsPage /></RequireAuth>} />
        <Route path="/me/settings" element={<RequireAuth><MeSettingsPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/map" replace />} />
      </Route>
    </Routes>
  )
}
