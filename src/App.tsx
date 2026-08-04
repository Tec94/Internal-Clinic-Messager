import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import {
  AccessErrorPage,
  AccessStatusPage,
  AuthCallbackPage,
  LoginPage,
  OnboardingPage,
} from './pages/AuthPages'
import { DirectoryPage } from './pages/DirectoryPage'
import { InboxPage } from './pages/InboxPage'
import { useAuth } from './state/AuthContext'
import { useMessaging } from './state/MessagingContext'

const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })),
)
const ChannelPage = lazy(() =>
  import('./pages/ChannelPage').then((module) => ({
    default: module.ChannelPage,
  })),
)
const TasksPage = lazy(() => import('./pages/ModulePages').then((module) => ({ default: module.TasksPage })))
const DocumentsPage = lazy(() => import('./pages/ModulePages').then((module) => ({ default: module.DocumentsPage })))
const MeetingsPage = lazy(() => import('./pages/ModulePages').then((module) => ({ default: module.MeetingsPage })))
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

export function App({ requireAuth = false }: { requireAuth?: boolean }) {
  const Workspace = requireAuth ? AuthenticatedWorkspace : AppShell

  return (
    <Suspense
      fallback={
        <RouteLoading />
      }
    >
      <Routes>
        <Route
          path="/login"
          element={requireAuth ? <LoginPage /> : <Navigate to="/inbox" replace />}
        />
        <Route
          path="/auth/callback"
          element={requireAuth ? <AuthCallbackPage /> : <Navigate to="/inbox" replace />}
        />
        <Route
          path="/onboarding"
          element={requireAuth ? <OnboardingPage /> : <Navigate to="/inbox" replace />}
        />
        <Route
          path="/access/suspended"
          element={
            requireAuth
              ? <AccessStatusPage status="suspended" />
              : <Navigate to="/inbox" replace />
          }
        />
        <Route
          path="/access/expired"
          element={
            requireAuth
              ? <AccessStatusPage status="expired" />
              : <Navigate to="/inbox" replace />
          }
        />
        <Route
          path="/auth/error"
          element={requireAuth ? <AccessErrorPage /> : <Navigate to="/inbox" replace />}
        />
        <Route element={<Workspace />}>
          <Route index element={<Navigate to="/inbox" replace />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/people" element={<DirectoryPage />} />
          <Route path="/directory" element={<Navigate to="/people" replace />} />
          <Route path="/tasks/:taskId?" element={<TasksPage />} />
          <Route path="/documents/:documentId?" element={<DocumentsPage />} />
          <Route path="/meetings/:meetingId?" element={<MeetingsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/todos" element={<Navigate to="/tasks" replace />} />
          <Route path="/channels" element={<ChannelLanding />} />
          <Route path="/channels/:channelId" element={<ChannelPage />} />
          <Route
            path="/admin/overview"
            element={<AdminPage section="overview" />}
          />
          <Route
            path="/admin/locations"
            element={<AdminPage section="locations" />}
          />
          <Route
            path="/admin/people"
            element={<AdminPage section="people" />}
          />
          <Route
            path="/admin/channels"
            element={<AdminPage section="channels" />}
          />
          <Route
            path="/admin/announcements"
            element={<AdminPage section="announcements" />}
          />
          <Route
            path="/admin/staffing"
            element={<AdminPage section="staffing" />}
          />
          <Route
            path="/admin/audit"
            element={<AdminPage section="audit" />}
          />
          <Route
            path="/admin/incidents/:incidentId"
            element={<AdminPage section="incident" />}
          />
          <Route
            path="/admin/settings"
            element={<AdminPage section="settings" />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/inbox" replace />} />
      </Routes>
    </Suspense>
  )
}

function AuthenticatedWorkspace() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <RouteLoading />
  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (status === 'onboarding') {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }
  if (status === 'suspended') {
    return <Navigate to="/access/suspended" replace />
  }
  if (status === 'expired') {
    return <Navigate to="/access/expired" replace />
  }
  if (status === 'error') {
    return <Navigate to="/auth/error" replace state={{ from: location }} />
  }
  return <AppShell authEnabled />
}

function ChannelLanding() {
  const { t } = useTranslation()
  const { channels, isLoading, error } = useMessaging()
  if (isLoading) return <RouteLoading />
  if (error) {
    return <div className="route-loading" role="alert">{error}</div>
  }
  const firstChannel = channels[0]
  return firstChannel
    ? <Navigate to={`/channels/${firstChannel.id}`} replace />
    : <div className="route-loading">{t('common.noResults')}</div>
}

function RouteLoading() {
  const { t } = useTranslation()
  return <div className="route-loading" role="status">{t('common.loading')}</div>
}
