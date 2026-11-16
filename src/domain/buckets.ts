import type { Bucket, ChangeSet, Status } from "../types.ts";

const STATUS_BUCKET: Partial<Record<Status, Bucket>> = {
  READY_TO_MERGE: "ready",
  DRAFT: "draft",
  STALE: "rotting",
};

export function deriveBucket(set: Pick<ChangeSet, "members" | "status" | "owner">): Bucket {
  if (set.members.every((m) => m.authorIsBot)) return "bot";
  return STATUS_BUCKET[set.status] ?? set.owner;
}
