import type { PullRequestFacts, SpecRule } from "../src/types.ts";

export interface Settings {
  theme: string;
  notify: boolean;
  specRule: SpecRule;
}

export function previewSpecMatch(pr: Pick<PullRequestFacts, "repoName" | "changedFilePaths">, rule: SpecRule): boolean {
  if (rule.useRepoSuffix) {
    const repo = pr.repoName.toLowerCase();
    if (rule.repoSuffixes.some((sfx) => repo.endsWith(sfx))) return true;
  }
  if (rule.useFileKeywords && rule.fileKeywords.length > 0) {
    return pr.changedFilePaths.some((path) => {
      const lower = path.toLowerCase();
      return rule.fileKeywords.some((kw) => lower.includes(kw));
    });
  }
  return false;
}

export function splitWords(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean))];
}

export function sameSettings(a: Settings, b: Settings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
