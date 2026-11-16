import type { AppState, ChangeSet } from "../src/types.ts";

export type View = "overview" | "mine" | "review";

export function setMatchesView(set: ChangeSet, view: View, viewerLogin: string | null): boolean;
export function countForView(state: Pick<AppState, "sets">, view: View, viewerLogin: string | null): number;
