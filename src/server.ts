import { PORT, SCAN_INTERVAL_MS } from "./config.ts";
import { getCachedState, isScanning, regroup, runScan } from "./scan.ts";
import { removeLink, setLink, setNote } from "./store.ts";
import type { AppState } from "./types.ts";

const PUBLIC_DIR = new URL("../public/", import.meta.url);

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

/** FR-6.22, Configuration "First-run state": the UI only ever reads this prepared snapshot. */
function currentStatePayload(): AppState & { scanning: boolean } {
  const state = getCachedState();
  const base: AppState = state ?? {
    meta: null as unknown as AppState["meta"], // no scan has completed yet; the client treats a null meta as "first run"
    prs: [],
    sets: [],
    alerts: [],
    history: [],
    notes: {},
    links: {},
  };
  return { ...base, scanning: isScanning() };
}

async function readJsonBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/api/state") {
      return jsonResponse(currentStatePayload());
    }

    // FR-7.23: manual refresh button.
    if (req.method === "POST" && url.pathname === "/api/refresh") {
      await runScan();
      return jsonResponse(currentStatePayload());
    }

    // FR-6.18-20: manual link/unlink, regrouped instantly, no GitHub refetch.
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

    // FR-6.21: free-text note per PR; clearing the text deletes it (handled in store.ts).
    if (req.method === "POST" && url.pathname.startsWith("/api/notes/")) {
      const prKey = decodeURIComponent(url.pathname.slice("/api/notes/".length));
      const body = await readJsonBody<{ text?: string }>(req);
      await setNote(prKey, body?.text ?? "");
      await regroup();
      return jsonResponse(currentStatePayload());
    }

    if (req.method === "GET") return serveStatic(url.pathname);

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Pull Request Manager listening on http://localhost:${server.port}`);

// Configuration "First-run state": load any snapshot left on disk before the first scan of
// this process completes, then kick the first scan off without blocking startup.
await regroup();
runScan().catch((err) => console.error("Initial scan failed:", err));

// FR-7.23: automatic rescan on a fixed interval.
setInterval(() => {
  runScan().catch((err) => console.error("Scheduled scan failed:", err));
}, SCAN_INTERVAL_MS);
