import type { ChangeSet, DerivedPullRequest } from "../src/types.ts";

export const NODE_W: number;
export const NODE_H: number;
export const GAP_X: number;
export const GAP_Y: number;
export const MIN_WIDE_W: number;
export const V_NODE_H: number;
export const V_GAP: number;
export const V_BUS_X: number;
export const V_NODE_X: number;

export interface NodeBox {
  prKey: string;
  pr: DerivedPullRequest;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Text of the merge-step badge: "1", "2" or "?". */
  badge: string;
}

export interface DiagramLayout {
  orientation: "wide" | "vertical";
  height: number;
  nodes: NodeBox[];
  /** The y of the horizontal bus, wide layout only. */
  busY?: number;
}

export function stepOf(pr: Pick<DerivedPullRequest, "mergeStep">): string;
export function rowStartX(count: number, avail: number): number;
export function diagramLayout(set: ChangeSet, avail: number): DiagramLayout;
