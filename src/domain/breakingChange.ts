import {
  BREAKING_CHANGE_CHECKBOX_RE,
  BREAKING_CHANGE_HEADING_RE,
  BREAKING_CHANGE_SCAN_LINES,
} from "../config.ts";
import type { BreakingDeclaration } from "../types.ts";

/**
 * FR-5.15: breaking change is declared by the author via the org's checkbox block, never
 * inferred from the diff. See config.ts for the documented assumption about the block's
 * shape (a heading containing "breaking change" followed by "- [ ] Yes" / "- [ ] No").
 */
export function parseBreakingChangeDeclaration(body: string): BreakingDeclaration {
  const lines = body.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => BREAKING_CHANGE_HEADING_RE.test(line));
  if (headingIndex === -1) return "MISSING";

  let yesChecked = false;
  let noChecked = false;
  const end = Math.min(lines.length, headingIndex + 1 + BREAKING_CHANGE_SCAN_LINES);
  for (let i = headingIndex + 1; i < end; i++) {
    const match = lines[i]!.match(BREAKING_CHANGE_CHECKBOX_RE);
    if (!match) continue;
    const checked = match[1]!.toLowerCase() === "x";
    const label = match[2]!.toLowerCase();
    if (label === "yes") yesChecked = checked;
    else if (label === "no") noChecked = checked;
  }

  if (yesChecked && !noChecked) return "BREAKING";
  if (noChecked && !yesChecked) return "NOT_BREAKING";
  return "UNDECLARED";
}
