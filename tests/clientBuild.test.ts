import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";

const repoFile = (name: string) => new URL(`../${name}`, import.meta.url);
const CLIENT_DIR = repoFile("client/").pathname;
const RULE_MODULES = ["html", "statusMeta", "views", "connectionsLayout", "settings"];

const pkg: { scripts: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } =
  await Bun.file(repoFile("package.json")).json();

describe("client sources (S-4 criterion 2)", () => {
  test("app and every rule module are TypeScript sources in client/", async () => {
    for (const module of ["app", ...RULE_MODULES]) {
      expect(await Bun.file(repoFile(`client/${module}.ts`)).exists()).toBe(true);
    }
  });

  test("client/ holds no hand-written declaration and no JavaScript", async () => {
    const files = await readdir(CLIENT_DIR, { recursive: true });
    expect(files.filter((name) => name.endsWith(".d.ts") || name.endsWith(".js"))).toEqual([]);
  });
});

describe("client build (S-4 criterion 3)", () => {
  test("bundles client/app.ts for the browser into one self-contained script", async () => {
    const result = await Bun.build({ entrypoints: [repoFile("client/app.ts").pathname], target: "browser" });
    expect(result.success).toBe(true);
    expect(result.outputs).toHaveLength(1);
    const bundle = await result.outputs[0].text();
    expect(bundle).not.toMatch(/^\s*import\s/m);
  });

  test("bun run build bundles the client for the browser", () => {
    expect(pkg.scripts.build).toContain("bun build");
    expect(pkg.scripts.build).toContain("client/app.ts");
    expect(pkg.scripts.build).toMatch(/--target[ =]browser/);
  });

  test("bun start builds the client before it starts the server", () => {
    expect(pkg.scripts.start).toMatch(/bun run build\s*&&.*src\/server\.ts/);
  });

  test("the built public/app.js is not committed", async () => {
    const ignored = (await Bun.file(repoFile(".gitignore")).text()).split("\n").map((line) => line.trim());
    expect(ignored.some((line) => line === "public/app.js" || line === "/public/app.js")).toBe(true);
  });
});

describe("typecheck and CI (S-4 criteria 5 and 8)", () => {
  test("bun run typecheck also checks the client project", () => {
    expect(pkg.scripts.typecheck).toMatch(/tsc[^&]*-p\s+client/);
  });

  test("CI builds the client before it runs the tests", async () => {
    const steps = (await Bun.file(repoFile(".github/workflows/ci.yml")).text())
      .split("\n")
      .map((line) => line.trim().replace(/^- run:\s*/, ""));
    const build = steps.indexOf("bun run build");
    expect(build).toBeGreaterThan(-1);
    expect(build).toBeLessThan(steps.indexOf("bun test"));
  });
});

describe("dependencies (S-4 criterion 9)", () => {
  test("there is no runtime dependency", () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
  });

  test("the dev dependencies stay @types/bun and typescript", () => {
    expect(Object.keys(pkg.devDependencies ?? {}).sort()).toEqual(["@types/bun", "typescript"]);
  });
});
