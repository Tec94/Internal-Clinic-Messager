import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DirectoryPage } from './pages/DirectoryPage'
import { InboxPage } from './pages/InboxPage'

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

export function App() {
  return (
    <Suspense
      fallback={
        <RouteLoading />
      }
    >
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/inbox" replace />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/people" element={<DirectoryPage />} />
          <Route path="/directory" element={<Navigate to="/people" replace />} />
          <Route path="/tasks/:taskId?" element={<TasksPage />} />
          <Route path="/documents/:documentId?" element={<DocumentsPage />} />
          <Route path="/meetings/:meetingId?" element={<MeetingsPage />} />
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

function RouteLoading() {
  const { t } = useTranslation()
  return <div className="route-loading" role="status">{t('common.loading')}</div>
}
