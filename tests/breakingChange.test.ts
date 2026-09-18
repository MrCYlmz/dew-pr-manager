import { describe, expect, test } from "bun:test";
import { parseBreakingChangeDeclaration } from "../src/domain/breakingChange.ts";

describe("parseBreakingChangeDeclaration", () => {
  test("no heading at all is missing", () => {
    expect(parseBreakingChangeDeclaration("Just a plain PR body.")).toBe("MISSING");
  });

  test("heading present but neither box ticked is undeclared", () => {
    const body = "## Breaking change\n- [ ] Yes\n- [ ] No\n";
    expect(parseBreakingChangeDeclaration(body)).toBe("UNDECLARED");
  });

  test("both boxes ticked is undeclared, not a decision", () => {
    const body = "## Breaking change\n- [x] Yes\n- [x] No\n";
    expect(parseBreakingChangeDeclaration(body)).toBe("UNDECLARED");
  });

  test("yes ticked is breaking", () => {
    const body = "## Breaking change\n- [x] Yes\n- [ ] No\n";
    expect(parseBreakingChangeDeclaration(body)).toBe("BREAKING");
  });

  test("no ticked is not breaking", () => {
    const body = "## Breaking change\n- [ ] Yes\n- [x] No\n";
    expect(parseBreakingChangeDeclaration(body)).toBe("NOT_BREAKING");
  });

  test("case-insensitive heading and checkbox markers", () => {
    const body = "### BREAKING CHANGES\n- [X] yes\n- [ ] no\n";
    expect(parseBreakingChangeDeclaration(body)).toBe("BREAKING");
  });
});
