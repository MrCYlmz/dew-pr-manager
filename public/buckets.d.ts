import type { ChangeSet } from "../src/types.ts";

export interface Bucket {
  key: string;
  rank: number;
  title: string;
  desc: string;
  icon: string;
  match: (set: ChangeSet) => boolean;
}

export const BUCKETS: readonly Bucket[];

// Every owner has a bucket, so every change set lands in one.
export function bucketFor(set: ChangeSet): Bucket;
