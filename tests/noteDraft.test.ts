import { describe, expect, test } from "bun:test";
import { drawerNoteText } from "../client/noteDraft.ts";
import type { Note } from "../src/types.ts";

const PR = "acme/payments#12";
const OTHER_PR = "acme/ledger#7";

const notes: Record<string, Note> = {
  [PR]: { prKey: PR, text: "ask about the migration", savedAt: "2026-11-17T08:00:00Z" },
};

describe("drawerNoteText", () => {
  test("without an unsaved note the drawer shows the saved note", () => {
    expect(drawerNoteText(PR, notes, null)).toBe("ask about the migration");
  });

  test("without a saved or unsaved note the drawer shows an empty field", () => {
    expect(drawerNoteText(OTHER_PR, notes, null)).toBe("");
  });

  test("a note the server failed to save beats the saved note on the same PR", () => {
    const unsaved = { prKey: PR, text: "ask about the migration, and the rollback" };
    expect(drawerNoteText(PR, notes, unsaved)).toBe("ask about the migration, and the rollback");
  });

  test("an unsaved note shows even when the PR has no saved note", () => {
    const unsaved = { prKey: OTHER_PR, text: "waiting on QA" };
    expect(drawerNoteText(OTHER_PR, notes, unsaved)).toBe("waiting on QA");
  });

  test("a cleared note that failed to delete stays empty instead of returning to the saved note", () => {
    expect(drawerNoteText(PR, notes, { prKey: PR, text: "" })).toBe("");
  });

  test("an unsaved note on another PR does not leak into this PR's drawer", () => {
    const unsaved = { prKey: OTHER_PR, text: "waiting on QA" };
    expect(drawerNoteText(PR, notes, unsaved)).toBe("ask about the migration");
  });
});
