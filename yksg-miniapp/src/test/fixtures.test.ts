import { describe, expect, it } from "vitest";

import {
  getFixtureScenario,
  getWorkspaceSnapshot,
} from "@/data/workspace-fixtures";

describe("workspace fixture selection", () => {
  it("selects supported development scenarios and falls back for unknown values", () => {
    expect(getFixtureScenario("?fixture=empty", true)).toBe("empty");
    expect(getFixtureScenario("?fixture=stress", true)).toBe("stress");
    expect(getFixtureScenario("?fixture=unknown", true)).toBe("default");
    expect(getFixtureScenario("", true)).toBe("default");
  });

  it("ignores the fixture selector outside development", () => {
    expect(getFixtureScenario("?fixture=stress", false)).toBe("default");
  });

  it("keeps empty channels visible while clearing active module data", () => {
    const snapshot = getWorkspaceSnapshot("empty");
    expect(snapshot.channels).toHaveLength(3);
    expect(snapshot.channels.every((channel) => channel.unreadCount === 0)).toBe(true);
    expect(snapshot.tasks).toHaveLength(0);
    expect(snapshot.meetings).toHaveLength(0);
    expect(snapshot.documents).toHaveLength(0);
    expect(snapshot.people).toHaveLength(0);
  });

  it("covers every task status and large unread values in stress mode", () => {
    const snapshot = getWorkspaceSnapshot("stress");
    expect(new Set(snapshot.tasks.map((task) => task.status))).toEqual(
      new Set([
        "pendingAcceptance",
        "accepted",
        "inProgress",
        "blocked",
        "done",
        "declined",
        "canceled",
      ]),
    );
    expect(Math.max(...snapshot.channels.map((channel) => channel.unreadCount))).toBeGreaterThan(999);
  });
});
