import { HISTORY_CAP } from "../config.ts";
import type { DerivedPullRequest, HistoryEvent } from "../types.ts";

/**
 * FR-7.24: diff two consecutive scans into transition events, including PRs that appeared
 * and PRs that vanished (merged or closed — the spec doesn't ask us to tell those apart).
 * A null `previous` means this is the server's first scan ever: there's no baseline to
 * diff against, so (matching FR-8.28's "a fresh baseline is not a change") it produces no
 * events rather than reporting every pre-existing PR as newly "appeared".
 */
export function diffScans(
  previous: DerivedPullRequest[] | null,
  current: DerivedPullRequest[],
  at: string,
): HistoryEvent[] {
  if (previous === null) return [];

  const previousByKey = new Map(previous.map((pr) => [pr.key, pr]));
  const currentByKey = new Map(current.map((pr) => [pr.key, pr]));
  const events: HistoryEvent[] = [];

  for (const pr of current) {
    const before = previousByKey.get(pr.key);
    if (before == null) {
      events.push({
        id: `${pr.key}:${at}:appeared`,
        at,
        prKey: pr.key,
        prTitle: pr.title,
        prUrl: pr.url,
        kind: "appeared",
        from: null,
        to: pr.status,
      });
    } else if (before.status !== pr.status) {
      events.push({
        id: `${pr.key}:${at}:transition`,
        at,
        prKey: pr.key,
        prTitle: pr.title,
        prUrl: pr.url,
        kind: "transition",
        from: before.status,
        to: pr.status,
      });
    }
  }

  for (const pr of previous) {
    if (!currentByKey.has(pr.key)) {
      events.push({
        id: `${pr.key}:${at}:vanished`,
        at,
        prKey: pr.key,
        prTitle: pr.title,
        prUrl: pr.url,
        kind: "vanished",
        from: pr.status,
        to: null,
      });
    }
  }

  return events;
}

/** FR-7.24: keep only the most recent HISTORY_CAP events. */
export function capHistory(events: HistoryEvent[], cap: number = HISTORY_CAP): HistoryEvent[] {
  return events.length > cap ? events.slice(events.length - cap) : events;
}

/**
 * FR-7.25: transitions since the user's previous visit, or the last 24 hours on a first
 * visit (sinceIso == null).
 */
export function selectRecentHistory(
  history: HistoryEvent[],
  sinceIso: string | null,
  now: Date = new Date(),
): HistoryEvent[] {
  const cutoff = sinceIso ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  return history.filter((e) => e.at >= cutoff);
}
