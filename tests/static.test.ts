import { describe, expect, test } from "bun:test";
import path from "node:path";
import { PUBLIC_DIR, resolvePublicFile, serveStatic } from "../src/static.ts";

const root = path.sep + path.join("srv", "app", "public");
const inside = (...parts: string[]) => path.join(root, ...parts);

describe("resolvePublicFile (CWE-22)", () => {
  test("serves index.html for / and plain names inside public/", () => {
    expect(resolvePublicFile("/", root)).toBe(inside("index.html"));
    expect(resolvePublicFile("/app.js", root)).toBe(inside("app.js"));
    expect(resolvePublicFile("/nested/styles.css", root)).toBe(inside("nested", "styles.css"));
  });

  test("a trailing separator on the root makes no difference", () => {
    expect(resolvePublicFile("/app.js", root + path.sep)).toBe(inside("app.js"));
  });

  test("rejects paths that resolve outside public/", () => {
    expect(resolvePublicFile("/../src/config.ts", root)).toBeNull();
    expect(resolvePublicFile("/../../etc/passwd", root)).toBeNull();
    expect(resolvePublicFile("/a/../../etc/passwd", root)).toBeNull();
  });

  test("rejects the percent-encoded variants too", () => {
    expect(resolvePublicFile("/..%2f..%2fetc%2fpasswd", root)).toBeNull();
    expect(resolvePublicFile("/%2e%2e/%2e%2e/etc/passwd", root)).toBeNull();
    expect(resolvePublicFile("/%2e%2e%2fsrc%2fconfig.ts", root)).toBeNull();
  });

  test("rejects a sibling directory that merely shares the root's prefix", () => {
    expect(resolvePublicFile("/../public-secrets/x", root)).toBeNull();
  });

  test("rejects malformed encoding and NUL bytes", () => {
    expect(resolvePublicFile("/%zz", root)).toBeNull();
    expect(resolvePublicFile("/app.js%00.txt", root)).toBeNull();
  });

  test("dot segments that stay inside public/ are fine", () => {
    expect(resolvePublicFile("/nested/../app.js", root)).toBe(inside("app.js"));
  });

  test("an absolute-looking path is taken relative to public/, never to the filesystem root", () => {
    expect(resolvePublicFile("//etc/passwd", root)).toBe(inside("etc", "passwd"));
  });
});

describe("serveStatic", () => {
  test("serves the real index.html", async () => {
    const res = await serveStatic("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<html");
  });

  test("answers 404 for a traversal to a file that does exist", async () => {
    const res = await serveStatic("/../src/config.ts");
    expect(res.status).toBe(404);
    expect(await Bun.file(path.join(PUBLIC_DIR, "..", "src", "config.ts")).exists()).toBe(true);
  });

  test("answers 404 for a missing file inside public/", async () => {
    expect((await serveStatic("/nope.html")).status).toBe(404);
  });
});
