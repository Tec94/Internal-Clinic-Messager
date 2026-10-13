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

// Copied from the Workspace task RPCs (ADR-0006): only active tasks change, and the checklist sets the status.
const isActive = (task: TaskMutableState) =>
  task.status === "accepted" || task.status === "inProgress";

const checklistStatus = (checklist: Record<string, boolean>): TaskStatus => {
  const items = Object.values(checklist);
  const completed = items.filter(Boolean).length;
  if (items.length > 0 && completed === items.length) return "done";
  return completed > 0 ? "inProgress" : "accepted";
};

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
    // No Workspace equivalent: the server starts work only when the first checklist item is checked.
    case "task/start":
      return updateTask(state, action.taskId, (task) =>
        task.status === "accepted" ? { ...task, status: "inProgress" } : task,
      );
    case "task/toggle-checklist":
      return updateTask(state, action.taskId, (task) => {
        if (!isActive(task) || !(action.itemId in task.checklist)) return task;
        const checklist = {
          ...task.checklist,
          [action.itemId]: !task.checklist[action.itemId],
        };
        return { ...task, checklist, status: checklistStatus(checklist) };
      });
    case "task/complete":
      return updateTask(state, action.taskId, (task) =>
        isActive(task) && Object.keys(task.checklist).length === 0
          ? { ...task, status: "done", blockerReason: undefined }
          : task,
      );
    case "task/report-blocker": {
      const reason = action.reason.trim();
      if (!reason) return state;
      return updateTask(state, action.taskId, (task) =>
        isActive(task)
          ? { ...task, status: "blocked", blockerReason: reason }
          : task,
      );
    }
    case "task/clear-blocker":
      return updateTask(state, action.taskId, (task) =>
        task.status === "blocked"
          ? {
              ...task,
              status: Object.values(task.checklist).some(Boolean) ? "inProgress" : "accepted",
              blockerReason: undefined,
            }
          : task,
      );
    case "task/reopen":
      return updateTask(state, action.taskId, (task) => {
        if (task.status !== "done") return task;
        // The Workspace asks a manager which item to reopen; the Mini App reopens the last one.
        const itemId = Object.keys(task.checklist).filter((id) => task.checklist[id]).pop();
        if (!itemId) return { ...task, status: "accepted" };
        return {
          ...task,
          status: "inProgress",
          checklist: { ...task.checklist, [itemId]: false },
        };
      });
    case "task/restore":
      return updateTask(state, action.taskId, (task) => ({
        ...task,
        status: action.task.status,
        declineReason: action.task.declineReason,
        blockerReason: action.task.blockerReason,
      }));
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
