import type { Note } from "../src/types.ts";

// A note the server failed to save. It lives only in the page, so a drawer rebuilt from
// appState.notes would otherwise silently put the saved text back.
export interface UnsavedNote {
  prKey: string;
  text: string;
}

// An empty unsaved text still wins: it is a delete that failed, not an absent note.
export function drawerNoteText(prKey: string, notes: Record<string, Note>, unsaved: UnsavedNote | null): string {
  if (unsaved?.prKey === prKey) return unsaved.text;
  return notes[prKey]?.text ?? "";
}
