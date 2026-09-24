export type MiniLocale = "vi-VN" | "en-US";

export type LocalizedText = Record<MiniLocale, string>;

export type FixtureScenario = "default" | "empty" | "stress";

export interface MiniMessage {
  id: string;
  senderName: string;
  senderInitials: string;
  body: LocalizedText;
  timeLabel: LocalizedText;
  unread: boolean;
  urgent?: boolean;
}

export interface MiniChannel {
  id: string;
  displayName: LocalizedText;
  purpose: LocalizedText;
  unreadCount: number;
  isUrgent: boolean;
  memberCount: number;
  messages: MiniMessage[];
}

export type TaskStatus =
  | "pendingAcceptance"
  | "accepted"
  | "inProgress"
  | "blocked"
  | "done"
  | "declined"
  | "canceled";

export type TaskAgendaSection =
  | "needsAttention"
  | "today"
  | "upcoming"
  | "history";

export interface MiniTaskChecklistItem {
  id: string;
  label: LocalizedText;
  completed: boolean;
}

export interface MiniTask {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  status: TaskStatus;
  agenda: TaskAgendaSection;
  dueLabel: LocalizedText;
  ownerName: string;
  creatorName: string;
  channelId?: string;
  urgent: boolean;
  checklist: MiniTaskChecklistItem[];
  declineReason?: string;
  blockerReason?: string;
}

export type MeetingResponse = "none" | "accepted" | "declined";
export type MeetingSection = "invitations" | "upcoming" | "past";

export interface MiniMeeting {
  id: string;
  title: LocalizedText;
  purpose: LocalizedText;
  startLabel: LocalizedText;
  durationLabel: LocalizedText;
  timezone: string;
  organizerName: string;
  provider: "Google Meet" | "Zoom";
  response: MeetingResponse;
  section: MeetingSection;
  channelId?: string;
}

export interface MiniDocument {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  typeLabel: LocalizedText;
  sizeLabel: string;
  uploadedBy: string;
  uploadedAtLabel: LocalizedText;
  channelId?: string;
  taskId?: string;
}

export interface MiniPerson {
  id: string;
  name: string;
  initials: string;
  title: LocalizedText;
  department: LocalizedText;
  location: LocalizedText;
  status: "active" | "away";
  channelId?: string;
}

export interface WorkspaceSnapshot {
  userDisplayName: string;
  scope: LocalizedText;
  channels: MiniChannel[];
  tasks: MiniTask[];
  meetings: MiniMeeting[];
  documents: MiniDocument[];
  people: MiniPerson[];
}

export interface TaskMutableState {
  status: TaskStatus;
  checklist: Record<string, boolean>;
  declineReason?: string;
  blockerReason?: string;
}

export interface MiniMutableState {
  tasks: Record<string, TaskMutableState>;
  meetingResponses: Record<string, MeetingResponse>;
}

export type MiniStateAction =
  | { type: "state/reset"; state: MiniMutableState }
  | { type: "task/accept"; taskId: string }
  | { type: "task/decline"; taskId: string; reason: string }
  | { type: "task/start"; taskId: string }
  | { type: "task/toggle-checklist"; taskId: string; itemId: string }
  | { type: "task/complete"; taskId: string }
  | { type: "task/report-blocker"; taskId: string; reason: string }
  | { type: "task/clear-blocker"; taskId: string }
  | { type: "task/reopen"; taskId: string }
  | { type: "task/restore"; taskId: string; task: TaskMutableState }
  | {
      type: "meeting/respond";
      meetingId: string;
      response: MeetingResponse;
    };
