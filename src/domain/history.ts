import { HISTORY_CAP } from "../config.ts";
import type { DerivedPullRequest, HistoryEvent } from "../types.ts";

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

export function capHistory(events: HistoryEvent[], cap: number = HISTORY_CAP): HistoryEvent[] {
  return events.length > cap ? events.slice(events.length - cap) : events;
}

export function selectRecentHistory(
  history: HistoryEvent[],
  sinceIso: string | null,
  now: Date = new Date(),
): HistoryEvent[] {
  const cutoff = sinceIso ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  return history.filter((e) => e.at >= cutoff);
}
