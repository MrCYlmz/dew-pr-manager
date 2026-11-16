export const BUCKETS = [
  { key: "bot", rank: 6, title: "Bot PRs", desc: "Automated PRs. Out of the way, but not hidden.", icon: "bot", match: (s) => s.members.every((m) => m.authorIsBot) },
  { key: "ready", rank: 1, title: "Ready to merge", desc: "Approved, mergeable, checks green. Go merge it.", icon: "checkCircle", match: (s) => s.status === "READY_TO_MERGE" },
  { key: "draft", rank: 5, title: "Drafts", desc: "Not ready for review yet.", icon: "edit", match: (s) => s.status === "DRAFT" },
  { key: "rotting", rank: 2, title: "Rotting", desc: "No activity in over a week. Close it, revive it, or leave a note.", icon: "clock", match: (s) => s.status === "STALE" },
  { key: "you", rank: 0, title: "Waiting on you", desc: "The next move is yours.", icon: "user", match: (s) => s.owner === "you" },
  { key: "reviewers", rank: 3, title: "Waiting on reviewers", desc: "Sitting with someone else for now.", icon: "users", match: (s) => s.owner === "reviewers" },
  { key: "author", rank: 4, title: "Waiting on the author", desc: "PRs you review, blocked until their author acts.", icon: "cornerUpLeft", match: (s) => s.owner === "author" },
];

export function bucketFor(set) {
  return BUCKETS.find((b) => b.match(set));
}
