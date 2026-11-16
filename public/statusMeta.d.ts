import type { Status } from "../src/types.ts";

export interface StatusMeta {
  label: string;
  color: string;
  icon: string;
  hollow?: boolean;
}

export const STATUS_META: Record<Status, StatusMeta>;
export const STATUS_ORDER: readonly Status[];
export function statusMeta(status: string): StatusMeta;
