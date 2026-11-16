import type { PullRequestFacts, SpecRule } from "../src/types.ts";

export interface Settings {
  theme: string;
  notify: boolean;
  specRule: SpecRule;
}

export function previewSpecMatch(pr: Pick<PullRequestFacts, "repoName" | "changedFilePaths">, rule: SpecRule): boolean;
export function splitWords(text: string): string[];
export function sameSettings(a: Settings, b: Settings): boolean;
