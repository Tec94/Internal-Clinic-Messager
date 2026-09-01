import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

import {
  getFixtureScenario,
  getWorkspaceSnapshot,
} from "@/data/workspace-fixtures";
import {
  createInitialMiniState,
  getMiniStateStorageKey,
  miniStateReducer,
  readMiniState,
  resolveMeeting,
  resolveTask,
  writeMiniState,
} from "@/state/mini-state";
import {
  FixtureScenario,
  MiniMeeting,
  MiniStateAction,
  MiniTask,
  WorkspaceSnapshot,
} from "@/types";

interface MiniStateContextValue {
  scenario: FixtureScenario;
  snapshot: WorkspaceSnapshot;
  tasks: MiniTask[];
  meetings: MiniMeeting[];
  dispatch: (action: MiniStateAction) => void;
  reset: () => void;
}

const MiniStateContext = createContext<MiniStateContextValue | null>(null);

export const MiniStateProvider = ({ children }: PropsWithChildren) => {
  const scenario = getFixtureScenario();
  const snapshot = useMemo(() => getWorkspaceSnapshot(scenario), [scenario]);
  const [state, dispatch] = useReducer(
    miniStateReducer,
    undefined,
    () => readMiniState(scenario, snapshot),
  );

  useEffect(() => {
    writeMiniState(scenario, state);
  }, [scenario, state]);

  const tasks = useMemo(
    () => snapshot.tasks.map((task) => resolveTask(task, state.tasks[task.id])),
    [snapshot.tasks, state.tasks],
  );
  const meetings = useMemo(
    () =>
      snapshot.meetings.map((meeting) =>
        resolveMeeting(meeting, state.meetingResponses[meeting.id]),
      ),
    [snapshot.meetings, state.meetingResponses],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(getMiniStateStorageKey(scenario));
    } catch {
      // Reset still succeeds in memory when storage is unavailable.
    }
    dispatch({ type: "state/reset", state: createInitialMiniState(snapshot) });
  }, [scenario, snapshot]);

  const value = useMemo(
    () => ({ scenario, snapshot, tasks, meetings, dispatch, reset }),
    [meetings, reset, scenario, snapshot, tasks],
  );

  return (
    <MiniStateContext.Provider value={value}>
      {children}
    </MiniStateContext.Provider>
  );
};

export const useMiniState = (): MiniStateContextValue => {
  const value = useContext(MiniStateContext);
  if (!value) throw new Error("useMiniState must be used within MiniStateProvider");
  return value;
};
