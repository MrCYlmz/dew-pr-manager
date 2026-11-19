import type { AppState, ChangeSet } from "../src/types.ts";

export type View = "overview" | "mine" | "review";

export function setMatchesView(set: ChangeSet, view: View, viewerLogin: string | null): boolean {
  if (view === "overview") return true;
  if (!viewerLogin) return false;
  if (view === "mine") return set.members.some((m) => m.author === viewerLogin);
  if (view === "review") return set.members.some((m) => (m.requestedReviewers || []).includes(viewerLogin));
  return true;
}

export function countForView(state: Pick<AppState, "sets">, view: View, viewerLogin: string | null): number {
  const sets = state.sets.filter((s) => setMatchesView(s, view, viewerLogin));
  return new Set(sets.flatMap((s) => s.members.map((m) => m.key))).size;
}
