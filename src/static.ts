import path from "node:path";
import { fileURLToPath } from "node:url";

export const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

// CWE-22: the request path is only ever a name *inside* public/. Decode first so an
// encoded `..%2f` can't slip past, then refuse anything that resolves outside the root
// (2026-09-21 ISO 27001 A.8.19 review, condition 2).
export function resolvePublicFile(pathname: string, root: string = PUBLIC_DIR): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^[\\/]+/, "");
  const rootDir = root.endsWith(path.sep) ? root : root + path.sep;
  const target = path.resolve(rootDir, relative);
  return target.startsWith(rootDir) ? target : null;
}

export async function serveStatic(pathname: string): Promise<Response> {
  const target = resolvePublicFile(pathname);
  if (target == null) return new Response("Not found", { status: 404 });
  const file = Bun.file(target);
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file);
}
