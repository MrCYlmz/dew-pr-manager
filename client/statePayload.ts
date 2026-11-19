import type { AppState, ScanMeta, SpecRule } from "../src/types.ts";

// What every /api route answers with (currentStatePayload in src/server.ts): AppState plus the
// scan flag and the setting defaults, with meta null until the first scan has finished.
export type StatePayload = Omit<AppState, "meta"> & {
  meta: ScanMeta | null;
  scanning: boolean;
  defaults: { notify: boolean; specRule: SpecRule };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Checks the top-level fields only: enough to tell a state payload from an error body or a
// broken response, without re-validating every PR the server already derived.
export function isStatePayload(body: unknown): body is StatePayload {
  if (!isRecord(body)) return false;
  return (
    (body.meta === null || isRecord(body.meta)) &&
    Array.isArray(body.prs) &&
    Array.isArray(body.sets) &&
    Array.isArray(body.history) &&
    isRecord(body.notes) &&
    isRecord(body.links) &&
    isRecord(body.specRule) &&
    isRecord(body.defaults) &&
    typeof body.notify === "boolean" &&
    typeof body.scanning === "boolean"
  );
}
