import type { DerivedPullRequest } from "../types.ts";

/**
 * The three ways a description points at another PR, in one pass so a qualified
 * "owner/repo#12" is never also read as a bare "#12" of this PR's own repo:
 *
 *   1. https://github.com/owner/repo/pull/12
 *   2. owner/repo#12
 *   3. #12                       (resolved against the mentioning PR's own repo)
 *
 * `bodyText` is GitHub's plain-text rendering, in which pasted PR URLs already come back as
 * form 2 or 3 — the URL form is kept for descriptions fetched any other way.
 */
const REFERENCE =
  /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)|(?<![\w/.-])([\w-]+)\/([\w.-]+)#(\d+)|(?<![\w/#])#(\d+)/g;

/**
 * PR keys this description mentions, in order of first appearance, minus the PR itself.
 *
 * A description is third-party text, so it may only ever point at PRs this scan already
 * fetched: anything that doesn't resolve to a key in `known` is dropped, and the UI links to
 * the stored `url` of the resolved PR, never to anything lifted from the description. Issue
 * references fall out the same way, since an issue number is never a known PR key.
 */
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

/** Fill `mentions` for every PR against the whole scan, so a mention always resolves to a real member. */
export function assignMentions(prs: DerivedPullRequest[]): DerivedPullRequest[] {
  const known = new Set(prs.map((p) => p.key));
  return prs.map((pr) => ({ ...pr, mentions: extractMentionedKeys(pr, known) }));
}
