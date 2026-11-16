import type { Status } from "../src/types.ts";

export interface StatusMeta {
  label: string;
  color: string;
  icon: string;
  hollow?: boolean;
}

export const STATUS_META: Record<Status, StatusMeta> = {
  // Colour is per action class (see the token comment in styles.css): statuses that share a
  // class share a hue and are told apart by icon + label. DRAFT is hollow: an outline, not a
  // fill, so its grey never competes with the chromatic steps.
  DRAFT: { label: "Draft", color: "var(--cls-neutral)", icon: "edit", hollow: true },
  CONFLICTED: { label: "Conflicted", color: "var(--cls-blocked)", icon: "alertTriangle" },
  CI_FAILING: { label: "CI failing", color: "var(--cls-blocked)", icon: "xCircle" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "var(--cls-blocked)", icon: "cornerUpLeft" },
  REVIEW_STALE: { label: "Review stale", color: "var(--cls-info)", icon: "rotateCw" },
  READY_TO_MERGE: { label: "Ready to merge", color: "var(--cls-success)", icon: "checkCircle" },
  STALE: { label: "Rotting", color: "var(--cls-stale)", icon: "clock" },
  NEEDS_REVIEW: { label: "Needs review", color: "var(--cls-info)", icon: "eye" },
};

export const STATUS_ORDER: readonly Status[] = Object.keys(STATUS_META).filter(isStatus);

function isStatus(status: string): status is Status {
  return Object.hasOwn(STATUS_META, status);
}

export function statusMeta(status: string): StatusMeta {
  return isStatus(status) ? STATUS_META[status] : { label: status, color: "var(--ink-muted)", icon: "alertCircle" };
}
