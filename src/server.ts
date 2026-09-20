import { PORT, SCAN_INTERVAL_MS } from "./config.ts";
import { getCachedState, isScanning, regroup, runScan } from "./scan.ts";
import { normalizeSpecRule } from "./domain/changeSets.ts";
import { removeLink, setLink, setNote, writeSpecRuleSetting } from "./store.ts";
import { DEFAULT_SPEC_RULE } from "./config.ts";
import type { AppState } from "./types.ts";

const PUBLIC_DIR = new URL("../public/", import.meta.url);

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const ALLOWED_HOSTS = new Set(LOOPBACK_HOSTS.flatMap((h) => [`${h}:${PORT}`, ...(PORT === 80 ? [h] : [])]));

function isAllowedHost(req: Request): boolean {
  const host = req.headers.get("host");
  return host != null && ALLOWED_HOSTS.has(host.toLowerCase());
}

function isSameOriginRequest(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site != null && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (origin != null) {
    try {
      return ALLOWED_HOSTS.has(new URL(origin).host.toLowerCase());
    } catch {
      return false;
    }
  }
  return true;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function serveStatic(pathname: string): Promise<Response> {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = Bun.file(new URL(relative, PUBLIC_DIR));
  if (!(await file.exists())) return new Response("Not found", { status: 404 });
  return new Response(file);
}

function currentStatePayload(): AppState & { scanning: boolean } {
  const state = getCachedState();
  const base: AppState = state ?? {
    meta: null as unknown as AppState["meta"],
    prs: [],
    sets: [],
    history: [],
    notes: {},
    links: {},
    specRule: DEFAULT_SPEC_RULE,
  };
  return { ...base, scanning: isScanning() };
}

async function readJsonBody<T>(req: Request): Promise<T | null> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    if (!isAllowedHost(req)) return new Response("Forbidden", { status: 403 });
    if (req.method !== "GET" && req.method !== "HEAD" && !isSameOriginRequest(req)) {
      return new Response("Forbidden", { status: 403 });
    }

    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/api/state") {
      return jsonResponse(currentStatePayload());
    }

    if (req.method === "POST" && url.pathname === "/api/refresh") {
      await runScan();
      return jsonResponse(currentStatePayload());
    }

    if (req.method === "POST" && url.pathname === "/api/links") {
      const body = await readJsonBody<{ prKey?: string; targetSetKey?: string }>(req);
      if (!body?.prKey || !body.targetSetKey) {
        return jsonResponse({ error: "prKey and targetSetKey are required" }, 400);
      }
      await setLink(body.prKey, body.targetSetKey);
      await regroup();
      return jsonResponse(currentStatePayload());
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/links/")) {
      const prKey = decodeURIComponent(url.pathname.slice("/api/links/".length));
      await removeLink(prKey);
      await regroup();
      return jsonResponse(currentStatePayload());
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/notes/")) {
      const prKey = decodeURIComponent(url.pathname.slice("/api/notes/".length));
      const body = await readJsonBody<{ text?: unknown }>(req);
      if (body == null || typeof body.text !== "string") {
        return jsonResponse({ error: "a JSON body with a string `text` is required" }, 400);
      }
      await setNote(prKey, body.text);
      await regroup();
      return jsonResponse(currentStatePayload());
    }

    if (url.pathname === "/api/settings/spec-rule" && (req.method === "PUT" || req.method === "DELETE")) {
      if (req.method === "PUT") {
        const body = await readJsonBody<unknown>(req);
        if (body == null || typeof body !== "object") {
          return jsonResponse({ error: "a JSON body describing the rule is required" }, 400);
        }
        await writeSpecRuleSetting(normalizeSpecRule(body));
      } else {
        await writeSpecRuleSetting(null);
      }
      await regroup();
      return jsonResponse(currentStatePayload());
    }

    if (req.method === "GET") return serveStatic(url.pathname);

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Pull Request Manager listening on http://localhost:${server.port}`);

await regroup();
runScan().catch((err) => console.error("Initial scan failed:", err));

setInterval(() => {
  runScan().catch((err) => console.error("Scheduled scan failed:", err));
}, SCAN_INTERVAL_MS);
