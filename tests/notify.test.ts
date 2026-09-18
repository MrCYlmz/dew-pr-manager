import { describe, expect, test } from "bun:test";
import { buildNotification } from "../src/notify.ts";
import type { HistoryEvent } from "../src/types.ts";

const event = (overrides: Partial<HistoryEvent> = {}): HistoryEvent => ({
  id: "1",
  at: "2026-09-18T00:00:00Z",
  prKey: "acme/a#1",
  prTitle: "t",
  prUrl: "u",
  kind: "transition",
  from: "NEEDS_REVIEW",
  to: "STALE",
  ...overrides,
});

describe("buildNotification", () => {
  test("no events means no notification", () => {
    expect(buildNotification([])).toBeNull();
  });

  test("a transition into READY_TO_MERGE outranks other transitions", () => {
    const result = buildNotification([
      event({ prKey: "a#1", to: "STALE" }),
      event({ prKey: "a#2", to: "READY_TO_MERGE" }),
    ]);
    expect(result?.body).toContain("a#2");
  });

  test("a transition into CONFLICTED outranks the rest when nothing is ready", () => {
    const result = buildNotification([
      event({ prKey: "a#1", to: "STALE" }),
      event({ prKey: "a#2", to: "CONFLICTED" }),
    ]);
    expect(result?.body).toContain("a#2");
  });

  test("counts every change in the title", () => {
    const result = buildNotification([event(), event({ id: "2" })]);
    expect(result?.title).toBe("Pull Request Manager: 2 changes");
  });

  test("singular change count reads naturally", () => {
    const result = buildNotification([event()]);
    expect(result?.title).toBe("Pull Request Manager: 1 change");
  });
});
