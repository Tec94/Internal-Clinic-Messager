import { describe, expect, it } from "vitest";

import { getWorkspaceSnapshot } from "@/data/workspace-fixtures";
import {
  createInitialMiniState,
  getMiniStateStorageKey,
  miniStateReducer,
  readMiniState,
  resolveMeeting,
  writeMiniState,
} from "@/state/mini-state";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("fixture-local state", () => {
  it("applies only valid task transitions", () => {
    const snapshot = getWorkspaceSnapshot("default");
    let state = createInitialMiniState(snapshot);
    const taskId = "confirm-doctor-schedule";

    const unchanged = miniStateReducer(state, { type: "task/start", taskId });
    expect(unchanged).toBe(state);

    state = miniStateReducer(state, { type: "task/accept", taskId });
    expect(state.tasks[taskId].status).toBe("accepted");
    state = miniStateReducer(state, { type: "task/start", taskId });
    expect(state.tasks[taskId].status).toBe("inProgress");

    const incomplete = miniStateReducer(state, { type: "task/complete", taskId });
    expect(incomplete).toBe(state);

    for (const item of snapshot.tasks[0].checklist) {
      state = miniStateReducer(state, {
        type: "task/toggle-checklist",
        taskId,
        itemId: item.id,
      });
    }
    state = miniStateReducer(state, { type: "task/complete", taskId });
    expect(state.tasks[taskId].status).toBe("done");
    state = miniStateReducer(state, { type: "task/reopen", taskId });
    expect(state.tasks[taskId].status).toBe("inProgress");
  });

  it("requires reasons and supports blocker recovery", () => {
    const snapshot = getWorkspaceSnapshot("default");
    let state = createInitialMiniState(snapshot);
    const taskId = "check-kiosk-b";

    expect(
      miniStateReducer(state, { type: "task/report-blocker", taskId, reason: " " }),
    ).toBe(state);

    state = miniStateReducer(state, {
      type: "task/report-blocker",
      taskId,
      reason: "Waiting for an operations check",
    });
    expect(state.tasks[taskId]).toMatchObject({
      status: "blocked",
      blockerReason: "Waiting for an operations check",
    });

    state = miniStateReducer(state, { type: "task/clear-blocker", taskId });
    expect(state.tasks[taskId]).toMatchObject({
      status: "inProgress",
      blockerReason: undefined,
    });
  });

  it("updates meeting responses", () => {
    const snapshot = getWorkspaceSnapshot("default");
    const state = createInitialMiniState(snapshot);
    const updated = miniStateReducer(state, {
      type: "meeting/respond",
      meetingId: "handoff-meeting",
      response: "accepted",
    });
    expect(updated.meetingResponses["handoff-meeting"]).toBe("accepted");
    const declined = resolveMeeting(snapshot.meetings[0], "declined");
    expect(declined.section).toBe("invitations");
    expect(declined.response).toBe("declined");
  });

  it("resets only to the active fixture's deterministic initial state", () => {
    const snapshot = getWorkspaceSnapshot("default");
    const initial = createInitialMiniState(snapshot);
    const changed = miniStateReducer(initial, {
      type: "task/accept",
      taskId: "confirm-doctor-schedule",
    });

    expect(changed.tasks["confirm-doctor-schedule"].status).toBe("accepted");
    expect(
      miniStateReducer(changed, { type: "state/reset", state: initial }),
    ).toEqual(initial);
  });

  it("persists scenarios independently and sanitizes unknown fixture IDs", () => {
    const storage = new MemoryStorage();
    const defaultSnapshot = getWorkspaceSnapshot("default");
    const emptySnapshot = getWorkspaceSnapshot("empty");
    const state = createInitialMiniState(defaultSnapshot);
    state.tasks["unknown-task"] = {
      status: "done",
      checklist: {},
    };

    writeMiniState("default", state, storage);
    const restored = readMiniState("default", defaultSnapshot, storage);
    const empty = readMiniState("empty", emptySnapshot, storage);

    expect(getMiniStateStorageKey("default")).not.toBe(
      getMiniStateStorageKey("empty"),
    );
    expect(restored.tasks["unknown-task"]).toBeUndefined();
    expect(Object.keys(empty.tasks)).toHaveLength(0);
  });
});
