import {
  FixtureScenario,
  LocalizedText,
  MiniChannel,
  MiniDocument,
  MiniMeeting,
  MiniPerson,
  MiniTask,
  WorkspaceSnapshot,
} from "@/types";

const local = (vi: string, en: string): LocalizedText => ({
  "vi-VN": vi,
  "en-US": en,
});

const defaultChannels: MiniChannel[] = [
  {
    id: "front-desk-home",
    displayName: local("Lễ tân — công việc chung", "Front desk — shared work"),
    purpose: local(
      "Điều phối công việc hằng ngày của lễ tân tại Cơ sở Trung tâm.",
      "Coordinates daily front desk work at Central Clinic.",
    ),
    unreadCount: 2,
    isUrgent: false,
    memberCount: 8,
    messages: [
      {
        id: "handoff-confirmation",
        senderName: "Võ Thành Nam",
        senderInitials: "TN",
        body: local(
          "Bạn xác nhận giúp thời gian bàn giao nhé?",
          "Can you confirm the handoff time?",
        ),
        timeLabel: local("09:42 hôm nay", "09:42 today"),
        unread: true,
      },
      {
        id: "handoff-reply",
        senderName: "Nguyễn Thu Hà",
        senderInitials: "TH",
        body: local(
          "Mình đã cập nhật danh sách bàn giao tại quầy.",
          "I updated the handoff list at the desk.",
        ),
        timeLabel: local("09:18 hôm nay", "09:18 today"),
        unread: false,
      },
    ],
  },
  {
    id: "front-desk-coverage",
    displayName: local("Điều phối nhân sự lễ tân", "Front desk coverage"),
    purpose: local(
      "Thay đổi phân công và điều phối lễ tân trong ngày.",
      "Coordinates same-day front desk staffing and coverage changes.",
    ),
    unreadCount: 1,
    isUrgent: true,
    memberCount: 6,
    messages: [
      {
        id: "coverage-change",
        senderName: "Trần Minh Anh",
        senderInitials: "MA",
        body: local(
          "Khẩn: cần người hỗ trợ quầy B từ 14:00 đến 15:30.",
          "Urgent: coverage is needed at desk B from 14:00 to 15:30.",
        ),
        timeLabel: local("10:06 hôm nay", "10:06 today"),
        unread: true,
        urgent: true,
      },
    ],
  },
  {
    id: "same-day-schedule",
    displayName: local(
      "Lịch trong ngày — Bác sĩ Nguyễn",
      "Today’s schedule — Dr. Nguyen",
    ),
    purpose: local(
      "Giải quyết thay đổi lịch tại Cơ sở Trung tâm mà không đưa thông tin người bệnh.",
      "Coordinates schedule changes at Central Clinic without patient information.",
    ),
    unreadCount: 1,
    isUrgent: false,
    memberCount: 5,
    messages: [
      {
        id: "schedule-note",
        senderName: "Lê Quốc Bảo",
        senderInitials: "QB",
        body: local(
          "Khung giờ cuối ngày đã được điều chỉnh trong lịch nội bộ.",
          "The final time slot was adjusted in the internal schedule.",
        ),
        timeLabel: local("08:50 hôm nay", "08:50 today"),
        unread: true,
      },
    ],
  },
];

const defaultTasks: MiniTask[] = [
  {
    id: "confirm-doctor-schedule",
    title: local(
      "Xác nhận thay đổi lịch bác sĩ Nguyễn",
      "Confirm Dr. Nguyen’s schedule change",
    ),
    summary: local(
      "Kiểm tra thay đổi và xác nhận lại với nhóm lễ tân.",
      "Review the change and confirm it with the front desk team.",
    ),
    status: "pendingAcceptance",
    agenda: "needsAttention",
    dueLabel: local("Hôm nay · 11:30", "Today · 11:30"),
    ownerName: "Phạm Ngọc Linh",
    creatorName: "Võ Thành Nam",
    channelId: "same-day-schedule",
    urgent: true,
    checklist: [
      {
        id: "review-change",
        label: local("Kiểm tra khung giờ mới", "Review the new time slot"),
        completed: false,
      },
      {
        id: "confirm-team",
        label: local("Xác nhận với nhóm lễ tân", "Confirm with the front desk team"),
        completed: false,
      },
    ],
  },
  {
    id: "check-kiosk-b",
    title: local("Kiểm tra máy check-in B", "Check kiosk B"),
    summary: local(
      "Hoàn tất kiểm tra vận hành đầu ca và ghi nhận kết quả.",
      "Complete the start-of-shift operational check and record the result.",
    ),
    status: "inProgress",
    agenda: "today",
    dueLabel: local("Hôm nay · 15:00", "Today · 15:00"),
    ownerName: "Phạm Ngọc Linh",
    creatorName: "Trần Minh Anh",
    channelId: "front-desk-home",
    urgent: false,
    checklist: [
      {
        id: "power-cycle",
        label: local("Khởi động và kiểm tra màn hình", "Start and check the display"),
        completed: true,
      },
      {
        id: "test-print",
        label: local("In thử phiếu không có dữ liệu", "Print a data-free test slip"),
        completed: false,
      },
    ],
  },
  {
    id: "prepare-handoff",
    title: local("Chuẩn bị bàn giao cuối ngày", "Prepare end-of-day handoff"),
    summary: local(
      "Tổng hợp các việc đang mở để bàn giao ca tiếp theo.",
      "Collect open operational items for the next shift.",
    ),
    status: "accepted",
    agenda: "upcoming",
    dueLabel: local("Ngày mai · 16:30", "Tomorrow · 16:30"),
    ownerName: "Phạm Ngọc Linh",
    creatorName: "Nguyễn Thu Hà",
    channelId: "front-desk-home",
    urgent: false,
    checklist: [
      {
        id: "collect-open-items",
        label: local("Tổng hợp việc đang mở", "Collect open items"),
        completed: false,
      },
    ],
  },
  {
    id: "archive-roster",
    title: local("Lưu bảng phân công tuần trước", "Archive last week’s roster"),
    summary: local(
      "Bảng phân công đã được kiểm tra và lưu vào thư mục nội bộ.",
      "The roster was reviewed and filed in the internal folder.",
    ),
    status: "done",
    agenda: "history",
    dueLabel: local("Hoàn tất hôm qua", "Completed yesterday"),
    ownerName: "Phạm Ngọc Linh",
    creatorName: "Trần Minh Anh",
    channelId: "front-desk-coverage",
    urgent: false,
    checklist: [
      {
        id: "archive-file",
        label: local("Lưu tệp phân công", "File the roster"),
        completed: true,
      },
    ],
  },
];

const defaultMeetings: MiniMeeting[] = [
  {
    id: "handoff-meeting",
    title: local("Họp bàn giao lễ tân", "Front desk handoff"),
    purpose: local(
      "Thống nhất nội dung bàn giao và phân công ca chiều.",
      "Align on handoff notes and afternoon coverage.",
    ),
    startLabel: local("Hôm nay · 10:00", "Today · 10:00"),
    durationLabel: local("30 phút", "30 minutes"),
    timezone: "Asia/Ho_Chi_Minh",
    organizerName: "Võ Thành Nam",
    provider: "Google Meet",
    response: "none",
    section: "invitations",
    channelId: "front-desk-home",
  },
  {
    id: "coverage-sync",
    title: local("Điều phối ca cuối tuần", "Weekend coverage sync"),
    purpose: local(
      "Rà soát khoảng trống nhân sự và người phụ trách.",
      "Review staffing gaps and accountable owners.",
    ),
    startLabel: local("Ngày mai · 09:30", "Tomorrow · 09:30"),
    durationLabel: local("25 phút", "25 minutes"),
    timezone: "Asia/Ho_Chi_Minh",
    organizerName: "Trần Minh Anh",
    provider: "Zoom",
    response: "accepted",
    section: "upcoming",
    channelId: "front-desk-coverage",
  },
  {
    id: "weekly-review",
    title: local("Tổng kết vận hành tuần", "Weekly operations review"),
    purpose: local(
      "Điểm lại các việc đã hoàn thành và vấn đề cần theo dõi.",
      "Review completed work and issues that need follow-up.",
    ),
    startLabel: local("Thứ Sáu tuần trước · 16:00", "Last Friday · 16:00"),
    durationLabel: local("45 phút", "45 minutes"),
    timezone: "Asia/Ho_Chi_Minh",
    organizerName: "Lê Quốc Bảo",
    provider: "Google Meet",
    response: "accepted",
    section: "past",
    channelId: "front-desk-home",
  },
];

const defaultDocuments: MiniDocument[] = [
  {
    id: "handoff-checklist",
    name: local("Danh sách bàn giao lễ tân.pdf", "Front desk handoff checklist.pdf"),
    description: local(
      "Mẫu bàn giao vận hành không chứa thông tin người bệnh.",
      "Operational handoff template without patient information.",
    ),
    typeLabel: local("Tài liệu PDF", "PDF document"),
    sizeLabel: "284 KB",
    uploadedBy: "Võ Thành Nam",
    uploadedAtLabel: local("Hôm nay · 08:40", "Today · 08:40"),
    channelId: "front-desk-home",
    taskId: "prepare-handoff",
  },
  {
    id: "kiosk-guide",
    name: local("Hướng dẫn kiểm tra máy check-in.pdf", "Kiosk check guide.pdf"),
    description: local(
      "Các bước kiểm tra thiết bị đầu ca.",
      "Start-of-shift equipment verification steps.",
    ),
    typeLabel: local("Tài liệu PDF", "PDF document"),
    sizeLabel: "412 KB",
    uploadedBy: "Trần Minh Anh",
    uploadedAtLabel: local("Hôm qua · 15:20", "Yesterday · 15:20"),
    channelId: "front-desk-home",
    taskId: "check-kiosk-b",
  },
  {
    id: "coverage-roster",
    name: local("Phân công lễ tân tuần này.xlsx", "This week’s front desk roster.xlsx"),
    description: local(
      "Bảng phân công nội bộ theo ca và vị trí.",
      "Internal roster organized by shift and station.",
    ),
    typeLabel: local("Bảng tính", "Spreadsheet"),
    sizeLabel: "96 KB",
    uploadedBy: "Nguyễn Thu Hà",
    uploadedAtLabel: local("Thứ Hai · 09:05", "Monday · 09:05"),
    channelId: "front-desk-coverage",
  },
];

const defaultPeople: MiniPerson[] = [
  {
    id: "pham-ngoc-linh",
    name: "Phạm Ngọc Linh",
    initials: "NL",
    title: local("Nhân viên lễ tân", "Front desk associate"),
    department: local("Lễ tân", "Front Desk"),
    location: local("Cơ sở Trung tâm", "Central Clinic"),
    status: "active",
    channelId: "front-desk-home",
  },
  {
    id: "vo-thanh-nam",
    name: "Võ Thành Nam",
    initials: "TN",
    title: local("Trưởng ca lễ tân", "Front desk shift lead"),
    department: local("Lễ tân", "Front Desk"),
    location: local("Cơ sở Trung tâm", "Central Clinic"),
    status: "active",
    channelId: "front-desk-home",
  },
  {
    id: "tran-minh-anh",
    name: "Trần Minh Anh",
    initials: "MA",
    title: local("Quản lý cơ sở", "Location manager"),
    department: local("Vận hành", "Operations"),
    location: local("Cơ sở Trung tâm", "Central Clinic"),
    status: "active",
    channelId: "front-desk-coverage",
  },
  {
    id: "nguyen-thu-ha",
    name: "Nguyễn Thu Hà",
    initials: "TH",
    title: local("Nhân viên lễ tân", "Front desk associate"),
    department: local("Lễ tân", "Front Desk"),
    location: local("Cơ sở Trung tâm", "Central Clinic"),
    status: "away",
    channelId: "front-desk-home",
  },
  {
    id: "le-quoc-bao",
    name: "Lê Quốc Bảo",
    initials: "QB",
    title: local("Điều phối lịch", "Schedule coordinator"),
    department: local("Điều phối", "Coordination"),
    location: local("Cơ sở Trung tâm", "Central Clinic"),
    status: "active",
    channelId: "same-day-schedule",
  },
];

const defaultSnapshot: WorkspaceSnapshot = {
  userDisplayName: "Phạm Ngọc Linh",
  scope: local("Cơ sở Trung tâm · Lễ tân", "Central Clinic · Front Desk"),
  channels: defaultChannels,
  tasks: defaultTasks,
  meetings: defaultMeetings,
  documents: defaultDocuments,
  people: defaultPeople,
};

const emptySnapshot: WorkspaceSnapshot = {
  ...defaultSnapshot,
  channels: defaultChannels.map((channel) => ({
    ...channel,
    unreadCount: 0,
    isUrgent: false,
    messages: channel.messages.map((message) => ({ ...message, unread: false })),
  })),
  tasks: [],
  meetings: [],
  documents: [],
  people: [],
};

const stressStatuses: MiniTask["status"][] = [
  "pendingAcceptance",
  "accepted",
  "inProgress",
  "blocked",
  "done",
  "declined",
  "canceled",
];

const stressTasks: MiniTask[] = stressStatuses.map((status, index) => ({
  id: `stress-task-${status}`,
  title: local(
    `Kiểm thử trạng thái ${status} với tiêu đề dài cho ca trực cuối ngày`,
    `Test the ${status} state with a long title for the final shift of the day`,
  ),
  summary: local(
    "Nội dung dài xác nhận tiêu đề, trạng thái, hạn và thao tác vẫn rõ ràng trên màn hình hẹp.",
    "Long content verifies that titles, status, due information, and actions remain clear on narrow screens.",
  ),
  status,
  agenda:
    status === "pendingAcceptance" || status === "blocked"
      ? "needsAttention"
      : status === "done" || status === "declined" || status === "canceled"
        ? "history"
        : index % 2 === 0
          ? "today"
          : "upcoming",
  dueLabel: local(`Ngày kiểm thử ${index + 1} · 16:45`, `Test day ${index + 1} · 16:45`),
  ownerName: "Phạm Ngọc Linh",
  creatorName: "Trần Minh Anh",
  channelId: defaultChannels[index % defaultChannels.length].id,
  urgent: index === 0 || index === 3,
  blockerReason: status === "blocked" ? "Thiếu xác nhận vận hành" : undefined,
  declineReason: status === "declined" ? "Đã chuyển cho ca phù hợp" : undefined,
  checklist: Array.from({ length: 5 }, (_, itemIndex) => ({
    id: `stress-${status}-${itemIndex}`,
    label: local(
      `Bước kiểm thử ${itemIndex + 1} với mô tả dài để kiểm tra xuống dòng`,
      `Stress step ${itemIndex + 1} with a long description to verify wrapping`,
    ),
    completed: status === "done" || itemIndex < 2,
  })),
}));

const stressMeetings: MiniMeeting[] = [
  ...defaultMeetings.map((meeting, index) => ({
    ...meeting,
    id: `stress-${meeting.id}`,
    title: local(
      `${meeting.title["vi-VN"]} — phối hợp nhiều nhóm trong ca cuối ngày`,
      `${meeting.title["en-US"]} — cross-team coordination during the final shift`,
    ),
    response: (["none", "accepted", "declined"] as const)[index],
    section: (["invitations", "upcoming", "past"] as const)[index],
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    ...defaultMeetings[1],
    id: `stress-meeting-${index}`,
    title: local(`Cuộc họp kiểm thử ${index + 1}`, `Stress meeting ${index + 1}`),
    startLabel: local(
      `Tuần tới · ${index + 8 < 10 ? "0" : ""}${index + 8}:30`,
      `Next week · ${index + 8 < 10 ? "0" : ""}${index + 8}:30`,
    ),
  })),
];

const stressSnapshot: WorkspaceSnapshot = {
  ...defaultSnapshot,
  channels: defaultChannels.map((channel, index) => ({
    ...channel,
    displayName: local(
      `${channel.displayName["vi-VN"]} — phối hợp nhiều bộ phận trong ca trực cuối ngày`,
      `${channel.displayName["en-US"]} — cross-team coordination for the final shift of the day`,
    ),
    purpose: local(
      `${channel.purpose["vi-VN"]} Nội dung kiểm thử dài xác nhận bố cục xuống dòng rõ ràng.`,
      `${channel.purpose["en-US"]} Long stress copy verifies clear wrapping on narrow screens.`,
    ),
    unreadCount: [128, 999, 2400][index],
  })),
  tasks: stressTasks,
  meetings: stressMeetings,
  documents: Array.from({ length: 8 }, (_, index) => ({
    ...defaultDocuments[index % defaultDocuments.length],
    id: `stress-document-${index}`,
    name: local(
      `Tài liệu vận hành kiểm thử có tên rất dài số ${index + 1}.pdf`,
      `Operational stress document with a very long name ${index + 1}.pdf`,
    ),
  })),
  people: Array.from({ length: 12 }, (_, index) => ({
    ...defaultPeople[index % defaultPeople.length],
    id: `stress-person-${index}`,
    name: `${defaultPeople[index % defaultPeople.length].name} ${index + 1}`,
    title: local(
      "Điều phối viên vận hành liên cơ sở với chức danh kiểm thử dài",
      "Cross-location operations coordinator with a long stress-test title",
    ),
  })),
};

export const getFixtureScenario = (
  search: string = typeof window === "undefined" ? "" : window.location.search,
  isDevelopment: boolean = import.meta.env.DEV,
): FixtureScenario => {
  if (!isDevelopment) return "default";

  const fixture = new URLSearchParams(search).get("fixture");
  return fixture === "empty" || fixture === "stress" ? fixture : "default";
};

export const getWorkspaceSnapshot = (
  scenario: FixtureScenario = getFixtureScenario(),
): WorkspaceSnapshot => {
  if (scenario === "empty") return emptySnapshot;
  if (scenario === "stress") return stressSnapshot;
  return defaultSnapshot;
};
