export type Status =
  | "DRAFT"
  | "CONFLICTED"
  | "CI_FAILING"
  | "CHANGES_REQUESTED"
  | "REVIEW_STALE"
  | "READY_TO_MERGE"
  | "STALE"
  | "NEEDS_REVIEW";

export type Owner = "you" | "author" | "reviewers";

export type MergeableState = "MERGEABLE" | "CONFLICTING" | "UNKNOWN";

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;

export type CheckRollupState = "SUCCESS" | "FAILURE" | "PENDING" | "NEUTRAL" | null;

export interface Review {
  author: string;
  state: string;
  submittedAt: string;
  commitSha: string;
}

export interface CheckItem {
  name: string;
  state: string;
}

/** Facts collected straight from GitHub for one PR (FR-1.3). Nothing derived. */
export interface PullRequestFacts {
  key: string; // "owner/repo#123"
  owner: string;
  repo: string; // "owner/repo"
  repoName: string; // "repo" alone, for the -openapi suffix check
  number: number;
  title: string;
  url: string;
  author: string;
  authorIsBot: boolean;
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  mergeableState: MergeableState;
  reviewDecision: ReviewDecision;
  reviews: Review[];
  requestedReviewers: string[]; // logins
  headCommitSha: string;
  checkRollupState: CheckRollupState;
  checks: CheckItem[];
  additions: number;
  deletions: number;
  changedFiles: number;
  changedFilePaths: string[];
  createdAt: string;
  lastCommitAt: string | null;
  lastCommentAt: string | null;
  lastReviewAt: string | null;
  body: string;
}

/** A PR plus everything the domain layer derives from those facts. */
export interface DerivedPullRequest extends PullRequestFacts {
  status: Status;
  owner: Owner;
  lastActivityAt: string;
  isSpecPR: boolean;
  branchSetKey: string; // grouping key from the head branch name
  setKey: string; // branchSetKey, unless a manual link overrides it
  manuallyLinked: boolean;
  mentions: string[]; // keys of other PRs in this scan that the description refers to
}

export interface ChangeSet {
  key: string;
  label: string;
  members: DerivedPullRequest[]; // already in merge order
  status: Status;
  owner: Owner;
  mergeOrderKnown: boolean;
  hasManualLink: boolean;
}

export type HistoryEventKind = "transition" | "appeared" | "vanished";

export interface HistoryEvent {
  id: string;
  at: string;
  prKey: string;
  prTitle: string;
  prUrl: string;
  kind: HistoryEventKind;
  from: Status | null;
  to: Status | null;
}

export interface ManualLink {
  prKey: string;
  targetSetKey: string;
}

export interface Note {
  prKey: string;
  text: string;
  savedAt: string;
}

export interface ScanMeta {
  scannedAt: string;
  ranAs: string;
  error: string | null;
  durationMs: number;
}

/** What the server hands the UI: one prepared snapshot, never a live GitHub call. */
export interface AppState {
  meta: ScanMeta;
  prs: DerivedPullRequest[];
  sets: ChangeSet[];
  history: HistoryEvent[];
  notes: Record<string, Note>;
  links: Record<string, string>; // prKey -> targetSetKey
}
