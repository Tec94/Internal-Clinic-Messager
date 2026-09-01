import {
  FixtureScenario,
  MeetingResponse,
  MiniMeeting,
  MiniMutableState,
  MiniStateAction,
  MiniTask,
  TaskAgendaSection,
  TaskMutableState,
  TaskStatus,
  WorkspaceSnapshot,
} from "@/types";

const STORAGE_PREFIX = "yksg-mini-demo-state-v1";

const taskStatuses: TaskStatus[] = [
  "pendingAcceptance",
  "accepted",
  "inProgress",
  "blocked",
  "done",
  "declined",
  "canceled",
];

const meetingResponses: MeetingResponse[] = ["none", "accepted", "declined"];

export const getMiniStateStorageKey = (scenario: FixtureScenario): string =>
  `${STORAGE_PREFIX}:${scenario}`;

export const createInitialMiniState = (
  snapshot: WorkspaceSnapshot,
): MiniMutableState => ({
  tasks: snapshot.tasks.reduce<Record<string, TaskMutableState>>(
    (tasks, task) => {
      tasks[task.id] = {
        status: task.status,
        checklist: task.checklist.reduce<Record<string, boolean>>(
          (checklist, item) => {
            checklist[item.id] = item.completed;
            return checklist;
          },
          {},
        ),
        declineReason: task.declineReason,
        blockerReason: task.blockerReason,
      };
      return tasks;
    },
    {},
  ),
  meetingResponses: snapshot.meetings.reduce<Record<string, MeetingResponse>>(
    (responses, meeting) => {
      responses[meeting.id] = meeting.response;
      return responses;
    },
    {},
  ),
});

const updateTask = (
  state: MiniMutableState,
  taskId: string,
  updater: (task: TaskMutableState) => TaskMutableState,
): MiniMutableState => {
  const task = state.tasks[taskId];
  if (!task) return state;

  const nextTask = updater(task);
  if (nextTask === task) return state;

  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: nextTask,
    },
  };
};

export const miniStateReducer = (
  state: MiniMutableState,
  action: MiniStateAction,
): MiniMutableState => {
  switch (action.type) {
    case "state/reset":
      return action.state;
    case "task/accept":
      return updateTask(state, action.taskId, (task) =>
        task.status === "pendingAcceptance"
          ? { ...task, status: "accepted", declineReason: undefined }
          : task,
      );
    case "task/decline": {
      const reason = action.reason.trim();
      if (!reason) return state;
      return updateTask(state, action.taskId, (task) =>
        task.status === "pendingAcceptance"
          ? { ...task, status: "declined", declineReason: reason }
          : task,
      );
    }
    case "task/start":
      return updateTask(state, action.taskId, (task) =>
        task.status === "accepted" ? { ...task, status: "inProgress" } : task,
      );
    case "task/toggle-checklist":
      return updateTask(state, action.taskId, (task) => {
        if (!["accepted", "inProgress", "blocked"].includes(task.status)) {
          return task;
        }
        if (!(action.itemId in task.checklist)) return task;
        return {
          ...task,
          checklist: {
            ...task.checklist,
            [action.itemId]: !task.checklist[action.itemId],
          },
        };
      });
    case "task/complete":
      return updateTask(state, action.taskId, (task) => {
        const completable = task.status === "accepted" || task.status === "inProgress";
        const checklistComplete = Object.values(task.checklist).every(Boolean);
        return completable && checklistComplete
          ? { ...task, status: "done", blockerReason: undefined }
          : task;
      });
    case "task/report-blocker": {
      const reason = action.reason.trim();
      if (!reason) return state;
      return updateTask(state, action.taskId, (task) =>
        task.status === "accepted" || task.status === "inProgress"
          ? { ...task, status: "blocked", blockerReason: reason }
          : task,
      );
    }
    case "task/clear-blocker":
      return updateTask(state, action.taskId, (task) =>
        task.status === "blocked"
          ? { ...task, status: "inProgress", blockerReason: undefined }
          : task,
      );
    case "task/reopen":
      return updateTask(state, action.taskId, (task) =>
        task.status === "done" ? { ...task, status: "inProgress" } : task,
      );
    case "meeting/respond":
      if (!(action.meetingId in state.meetingResponses)) return state;
      return {
        ...state,
        meetingResponses: {
          ...state.meetingResponses,
          [action.meetingId]: action.response,
        },
      };
  }
};

const agendaForStatus = (
  status: TaskStatus,
  originalAgenda: TaskAgendaSection,
): TaskAgendaSection => {
  if (status === "pendingAcceptance" || status === "blocked") {
    return "needsAttention";
  }
  if (status === "done" || status === "declined" || status === "canceled") {
    return "history";
  }
  if (originalAgenda === "needsAttention" || originalAgenda === "history") {
    return "today";
  }
  return originalAgenda;
};

export const resolveTask = (
  task: MiniTask,
  mutable: TaskMutableState | undefined,
): MiniTask => {
  if (!mutable) return task;
  return {
    ...task,
    status: mutable.status,
    agenda: agendaForStatus(mutable.status, task.agenda),
    declineReason: mutable.declineReason,
    blockerReason: mutable.blockerReason,
    checklist: task.checklist.map((item) => ({
      ...item,
      completed: mutable.checklist[item.id] ?? item.completed,
    })),
  };
};

export const resolveMeeting = (
  meeting: MiniMeeting,
  response: MeetingResponse | undefined,
): MiniMeeting => {
  if (!response || response === meeting.response) return meeting;
  return {
    ...meeting,
    response,
    section:
      response === "none"
        ? "invitations"
        : response === "declined"
          ? "past"
          : meeting.section === "past"
            ? "past"
            : "upcoming",
  };
};

const sanitizePersistedState = (
  value: unknown,
  snapshot: WorkspaceSnapshot,
): MiniMutableState => {
  const initial = createInitialMiniState(snapshot);
  if (!value || typeof value !== "object") return initial;

  const candidate = value as Partial<MiniMutableState>;
  const tasks = { ...initial.tasks };
  const meetings = { ...initial.meetingResponses };

  for (const task of snapshot.tasks) {
    const storedTask = candidate.tasks?.[task.id];
    if (!storedTask || !taskStatuses.includes(storedTask.status)) continue;
    tasks[task.id] = {
      status: storedTask.status,
      checklist: task.checklist.reduce<Record<string, boolean>>(
        (checklist, item) => {
          checklist[item.id] =
            typeof storedTask.checklist?.[item.id] === "boolean"
              ? storedTask.checklist[item.id]
              : item.completed;
          return checklist;
        },
        {},
      ),
      declineReason:
        typeof storedTask.declineReason === "string"
          ? storedTask.declineReason
          : undefined,
      blockerReason:
        typeof storedTask.blockerReason === "string"
          ? storedTask.blockerReason
          : undefined,
    };
  }

  for (const meeting of snapshot.meetings) {
    const storedResponse = candidate.meetingResponses?.[meeting.id];
    if (storedResponse && meetingResponses.includes(storedResponse)) {
      meetings[meeting.id] = storedResponse;
    }
  }

  return { tasks, meetingResponses: meetings };
};

export const readMiniState = (
  scenario: FixtureScenario,
  snapshot: WorkspaceSnapshot,
  storage: Pick<Storage, "getItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage,
): MiniMutableState => {
  if (!storage) return createInitialMiniState(snapshot);
  try {
    const raw = storage.getItem(getMiniStateStorageKey(scenario));
    return raw
      ? sanitizePersistedState(JSON.parse(raw), snapshot)
      : createInitialMiniState(snapshot);
  } catch {
    return createInitialMiniState(snapshot);
  }
};

export const writeMiniState = (
  scenario: FixtureScenario,
  state: MiniMutableState,
  storage: Pick<Storage, "setItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage,
): void => {
  if (!storage) return;
  try {
    storage.setItem(getMiniStateStorageKey(scenario), JSON.stringify(state));
  } catch {
    // The demo remains usable for the current session when storage is unavailable.
  }
};
