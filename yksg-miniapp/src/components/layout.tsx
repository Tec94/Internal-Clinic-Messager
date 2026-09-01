import { Navigate } from "react-router-dom";
import { AnimationRoutes, App, Route, ZMPRouter } from "zmp-ui";

import { AppShell } from "@/components/AppShell";
import { ChatPage } from "@/pages/ChatPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { InboxPage } from "@/pages/InboxPage";
import { MeetingsPage } from "@/pages/MeetingsPage";
import { PeoplePage } from "@/pages/PeoplePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TasksPage } from "@/pages/TasksPage";
import { MiniStateProvider } from "@/state/MiniStateContext";

const MiniAppRoutes = () => (
  <AppShell>
    <AnimationRoutes>
      <Route path="/" element={<InboxPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:channelId" element={<ChatPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/tasks/:taskId" element={<TasksPage />} />
      <Route path="/meetings" element={<MeetingsPage />} />
      <Route path="/meetings/:meetingId" element={<MeetingsPage />} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/documents/:documentId" element={<DocumentsPage />} />
      <Route path="/people" element={<PeoplePage />} />
      <Route path="/people/:personId" element={<PeoplePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </AnimationRoutes>
  </AppShell>
);

const Layout = () => (
  <App theme="light">
    <MiniStateProvider>
      <ZMPRouter memoryRouter>
        <MiniAppRoutes />
      </ZMPRouter>
    </MiniStateProvider>
  </App>
);

export default Layout;
