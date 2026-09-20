import type { DerivedPullRequest } from "../types.ts";

const REFERENCE =
  /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)|(?<![\w/.-])([\w-]+)\/([\w.-]+)#(\d+)|(?<![\w/#])#(\d+)/g;

export function extractMentionedKeys(
  pr: Pick<DerivedPullRequest, "key" | "repo" | "body">,
  known: ReadonlySet<string>,
): string[] {
  const keys: string[] = [];
  for (const m of pr.body.matchAll(REFERENCE)) {
    const key =
      m[1] != null ? `${m[1]}/${m[2]}#${Number(m[3])}`
      : m[4] != null ? `${m[4]}/${m[5]}#${Number(m[6])}`
      : `${pr.repo}#${Number(m[7])}`;
    if (key !== pr.key && known.has(key) && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

export function assignMentions(prs: DerivedPullRequest[]): DerivedPullRequest[] {
  const known = new Set(prs.map((p) => p.key));
  return prs.map((pr) => ({ ...pr, mentions: extractMentionedKeys(pr, known) }));
}
