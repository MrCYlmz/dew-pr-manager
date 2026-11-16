import type { Bucket, ChangeSet, DerivedPullRequest, HistoryEvent, Owner } from "../src/types.ts";
import { diagramLayout, stepOf, V_BUS_X, type DiagramLayout, type NodeBox } from "./connectionsLayout.ts";
import { escapeHtml, html, raw } from "./html.ts";
import { previewSpecMatch, sameSettings, splitWords, type Settings } from "./settings.ts";
import { isStatePayload, type StatePayload } from "./statePayload.ts";
import { statusMeta, type StatusMeta } from "./statusMeta.ts";
import { countForView, setMatchesView, type View } from "./views.ts";

const POLL_MS = 20000;
const LAST_VISIT_KEY = "prManagerLastVisit";

const sessionCutoff = localStorage.getItem(LAST_VISIT_KEY);
localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());

const ICON_PATHS: Record<string, string> = {
  check: "M20 6L9 17l-5-5",
  checkCircle: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3",
  xCircle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6",
  alertTriangle: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  cornerUpLeft: "M9 14L4 9l5-5M20 20v-7a4 4 0 0 0-4-4H4",
  rotateCw: "M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  edit: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z",
  x: "M18 6L6 18M6 6l12 12",
  externalLink: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
  gitBranch: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9",
  note: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  link: "M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  bot: "M12 8V4H8M4 8h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM2 14h2M20 14h2M15 13v2M9 13v2",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  alertCircle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  monitor: "M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8 21h8M12 17v4",
};

function icon(name: string, cls = ""): string {
  const d = ICON_PATHS[name];
  if (!d) return "";
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "unknown";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(0, Math.floor(ms / 60000));
  return `${mins}m ago`;
}

function shortAge(iso: string | null): string {
  if (!iso) return "?";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(0, Math.floor(ms / 60000))}m`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function shortRef(pr: DerivedPullRequest): string {
  return `${pr.repoName ?? pr.repo}#${pr.number}`;
}

function shortKey(prKey: string): string {
  return prKey.includes("/") ? prKey.slice(prKey.indexOf("/") + 1) : prKey;
}

const VIEWS: View[] = ["overview", "mine", "review"];

function viewFrom(value: string | null): View {
  return VIEWS.find((view) => view === value) ?? "overview";
}

// The elements index.html and the render functions write; one missing is a broken page, not a state to handle.
function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`#${id} is missing or not a ${type.name}`);
  return el;
}

let appState: StatePayload | null = null;
let currentView = viewFrom(new URLSearchParams(location.search).get("view"));
let drawerPrKey: string | null = null;

const els = {
  scanMeta: byId("scan-meta", HTMLElement),
  errorBanner: byId("error-banner", HTMLElement),
  summary: byId("summary", HTMLElement),
  changes: byId("changes-section", HTMLElement),
  connections: byId("connections-section", HTMLElement),
  buckets: byId("buckets-section", HTMLElement),
  drawer: byId("drawer", HTMLElement),
  scrim: byId("drawer-scrim", HTMLElement),
  refreshBtn: byId("refresh-btn", HTMLButtonElement),
  refreshIcon: byId("refresh-icon", HTMLElement),
  refreshLabel: byId("refresh-label", HTMLElement),
  settings: byId("settings", HTMLElement),
  settingsBtn: byId("settings-btn", HTMLButtonElement),
  tabs: byId("tabs", HTMLElement),
  shell: byId("main", HTMLElement),
};

els.refreshIcon.innerHTML = icon("rotateCw");
byId("settings-icon", HTMLElement).innerHTML = icon("sliders");

// Theme: a per-browser preference in localStorage, never sent to the server — the spec-PR rule
// is still the only setting the server persists. "auto" means no data-theme attribute, so the OS
// media query decides. index.html applies the saved value before first paint; this re-applies it
// on change from the Appearance section of the settings drawer.
const THEME_KEY = "prManagerTheme";
const THEMES = [
  { key: "auto", label: "Auto", icon: "monitor", hint: "Follows the operating system." },
  { key: "light", label: "Light", icon: "sun", hint: "Always light." },
  { key: "dark", label: "Dark", icon: "moon", hint: "Always dark." },
];
function themeFor(key: string | null) {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
function currentTheme() {
  let key = null;
  try { key = localStorage.getItem(THEME_KEY); } catch {}
  return themeFor(key);
}
function setTheme(key: string) {
  const theme = themeFor(key);
  try {
    if (theme.key === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme.key);
  } catch {}
  if (theme.key === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme.key;
  return theme;
}

// Every /api route answers with the state payload. A network failure, a non-OK status or any
// other body gives null, so callers keep the last good state instead of rendering a broken one.
async function requestState(path: string, init?: RequestInit): Promise<StatePayload | null> {
  try {
    const res = await fetch(path, init);
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isStatePayload(body) ? body : null;
  } catch {
    return null;
  }
}

async function fetchState({ skipDrawer = false }: { skipDrawer?: boolean } = {}) {
  const state = await requestState("/api/state");
  if (!state) return;
  appState = state;
  render({ skipDrawer });
}

async function refresh() {
  els.refreshBtn.disabled = true;
  els.refreshLabel.textContent = "Scanning…";
  els.shell.classList.add("is-refetching");
  try {
    const state = await requestState("/api/refresh", { method: "POST" });
    if (state) {
      appState = state;
      render({ skipDrawer: drawerPrKey != null });
    }
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshLabel.textContent = "Refresh";
    els.shell.classList.remove("is-refetching");
  }
}

els.refreshBtn.addEventListener("click", refresh);

els.tabs.addEventListener("click", (e) => {
  const btn = e.target instanceof Element ? e.target.closest("[data-view]") : null;
  if (!btn) return;
  currentView = viewFrom(btn.getAttribute("data-view"));
  const url = new URL(location.href);
  url.searchParams.set("view", currentView);
  history.pushState({}, "", url);
  render();
});

window.addEventListener("popstate", () => {
  currentView = viewFrom(new URLSearchParams(location.search).get("view"));
  render();
});

function visibleSets() {
  if (!appState) return [];
  const viewerLogin = appState.meta?.ranAs ?? null;
  return appState.sets.filter((s) => setMatchesView(s, currentView, viewerLogin));
}

function render({ skipDrawer = false }: { skipDrawer?: boolean } = {}) {
  renderHeader();
  renderTabs();
  if (!appState) return;

  if (!appState.meta) {
    renderFirstRun();
    return;
  }

  els.shell.classList.remove("is-firstrun");
  const sets = visibleSets();
  const prs = sets.flatMap((s) => s.members);
  renderSummary(sets, prs);
  renderBuckets(sets);
  renderChanges(appState.history, new Set(prs.map((p) => p.key)));
  renderConnections(sets);
  if (!skipDrawer) renderDrawer();
}

function renderFirstRun() {
  els.shell.classList.add("is-firstrun");
  els.summary.innerHTML = "";
  els.changes.innerHTML = "";
  els.connections.innerHTML = "";
  els.buckets.innerHTML = html`<div class="empty empty-big">
    ${raw(icon("inbox"))}
    <div>Scanning GitHub for the first time…</div>
    <div style="margin-top:4px">Your PRs will appear here as soon as the first scan finishes.</div>
  </div>`;
}

function renderHeader() {
  if (!appState) {
    els.scanMeta.textContent = "Starting up…";
    return;
  }
  if (!appState.meta) {
    els.scanMeta.innerHTML = html`<span class="scan-dot is-scanning"></span>First scan running…`;
    els.errorBanner.classList.add("hidden");
    return;
  }

  const { scannedAt, ranAs, error } = appState.meta;
  const dotClass = error ? "is-error" : appState.scanning ? "is-scanning" : "";
  const tail = appState.scanning ? " · scanning now" : "";
  els.scanMeta.innerHTML = html`<span class="scan-dot ${raw(dotClass)}"></span>Last scan ${timeAgo(scannedAt)} as <strong>${ranAs}</strong>${tail}`;

  if (error) {
    els.errorBanner.innerHTML = html`${raw(icon("alertTriangle"))}<div><strong>Last scan failed.</strong> ${error} — showing the last good data.</div>`;
    els.errorBanner.classList.remove("hidden");
  } else {
    els.errorBanner.classList.add("hidden");
  }
}

function renderTabs() {
  for (const btn of els.tabs.querySelectorAll("[data-view]")) {
    btn.classList.toggle("is-active", btn.getAttribute("data-view") === currentView);
  }
  for (const view of VIEWS) {
    byId(`count-${view}`, HTMLElement).textContent = appState?.meta ? String(countForView(appState, view, appState.meta.ranAs ?? null)) : "";
  }
}

function renderSummary(sets: ChangeSet[], prs: DerivedPullRequest[]) {
  const ready = sets.filter((s) => s.status === "READY_TO_MERGE").length;
  const rotting = sets.filter((s) => s.status === "STALE").length;
  const blocked = sets.filter((s) => ["CONFLICTED", "CI_FAILING", "CHANGES_REQUESTED"].includes(s.status)).length;

  const tiles = [
    { value: prs.length, label: "Open PRs", icon: "layers" },
    { value: sets.length, label: "Change sets", icon: "gitBranch" },
    { value: ready, label: "Ready to merge", icon: "checkCircle" },
    { value: blocked + rotting, label: "Blocked or rotting", icon: "alertTriangle" },
  ];

  els.summary.innerHTML = html`
    <div class="tiles">
      ${raw(tiles.map((t) => html`<div class="tile">
        <div class="tile-value ${raw(t.value === 0 ? "is-zero" : "")}">${t.value}</div>
        <div class="tile-label tile-accent">${raw(icon(t.icon))}${t.label}</div>
      </div>`).join(""))}
    </div>`;
}

function swatch(meta: StatusMeta): string {
  return meta.hollow
    ? `<span class="swatch swatch-hollow" style="color:${meta.color}"></span>`
    : `<span class="swatch" style="background:${meta.color}"></span>`;
}

// Class list for an SVG status mark (.node-rail / .node-dot); the CSS turns hollow into an outline.
function markClass(base: string, meta: StatusMeta): string {
  return meta.hollow ? `${base} is-hollow` : base;
}

function statusChip(status: string): string {
  const meta = statusMeta(status);
  return html`<span class="chip chip-status">${raw(swatch(meta))}${meta.label}</span>`;
}

function prRow(pr: DerivedPullRequest): string {
  const meta = statusMeta(pr.status);
  const note = appState?.notes[pr.key];
  const flags = [
    pr.authorIsBot ? html`<span class="chip chip-bot">bot</span>` : "",
    pr.manuallyLinked ? html`<span class="chip chip-linked">linked</span>` : "",
    note ? html`<span class="chip chip-note" title="${note.text}">${raw(icon("note"))}</span>` : "",
  ].join("");

  return html`<button type="button" class="pr-row" data-pr-key="${pr.key}" data-step="${raw(stepOf(pr))}" title="${pr.title}">
    <span style="color:${raw(meta.color)};display:flex">${raw(icon(meta.icon, "st-icon"))}</span>
    <span class="pr-line">
      <span class="pr-ref">${raw(escapeHtml(shortRef(pr)))}</span>
      <span class="pr-title">${pr.title}</span>
    </span>
    <span class="pr-right">
      ${raw(flags)}
      <span class="diff"><span class="add">+${pr.additions}</span> <span class="del">−${pr.deletions}</span></span>
      <span class="chip chip-meta">${raw(shortAge(pr.lastActivityAt))}</span>
      ${raw(statusChip(pr.status))}
    </span>
  </button>`;
}

function setCard(set: ChangeSet): string {
  const meta = statusMeta(set.status);
  const orderNote = set.mergeOrderKnown
    ? html`${raw(icon("zap"))}Merge the spec PR${raw(set.members.filter((m) => m.isSpecPR).length > 1 ? "s" : "")} first (step 1), then the consumers (step 2) in any order.`
    : html`${raw(icon("alertCircle"))}Merge order unknown — no spec PR in this set, so nothing says which goes first.`;

  return html`<div class="set">
    <div class="set-head">
      <span style="color:${raw(meta.color)};display:flex">${raw(icon("gitBranch", "set-icon"))}</span>
      <span class="set-label">${set.label}</span>
      <span class="set-meta">${plural(set.members.length, "PR", "PRs")}</span>
      <span class="set-spacer"></span>
      ${raw(set.hasManualLink ? html`<span class="chip chip-linked">has manual link</span>` : "")}
      ${raw(statusChip(set.status))}
    </div>
    <div class="set-members ${raw(set.mergeOrderKnown ? "" : "order-unknown")}">
      ${raw(set.members.map((m) => prRow(m)).join(""))}
    </div>
    <div class="set-note">${raw(orderNote)}</div>
  </div>`;
}

const BUCKETS: { key: Bucket; title: string; desc: string; icon: string }[] = [
  { key: "you", title: "Waiting on you", desc: "The next move is yours.", icon: "user" },
  { key: "ready", title: "Ready to merge", desc: "Approved, mergeable, checks green. Go merge it.", icon: "checkCircle" },
  { key: "rotting", title: "Rotting", desc: "No activity in over a week. Close it, revive it, or leave a note.", icon: "clock" },
  { key: "reviewers", title: "Waiting on reviewers", desc: "Sitting with someone else for now.", icon: "users" },
  { key: "author", title: "Waiting on the author", desc: "PRs you review, blocked until their author acts.", icon: "cornerUpLeft" },
  { key: "draft", title: "Drafts", desc: "Not ready for review yet.", icon: "edit" },
  { key: "bot", title: "Bot PRs", desc: "Automated PRs. Out of the way, but not hidden.", icon: "bot" },
];

function renderBuckets(sets: ChangeSet[]) {
  const sections = BUCKETS
    .map((b) => ({ b, list: sets.filter((s) => s.bucket === b.key) }))
    .filter(({ list }) => list.length > 0)
    .map(({ b, list }) => {
      const prCount = list.reduce((n, s) => n + s.members.length, 0);
      const body = list
        .map((s) => (s.members.length === 1 ? prRow(s.members[0]) : setCard(s)))
        .join("");
      return html`<section class="panel">
        <div class="panel-head">
          <h2 class="panel-title">${b.title}</h2>
          <span class="panel-count">${raw(plural(prCount, "PR", "PRs"))}</span>
        </div>
        <p class="panel-desc">${b.desc}</p>
        <div class="panel-body">${raw(body)}</div>
      </section>`;
    })
    .join("");

  els.buckets.innerHTML = sections || html`<div class="empty empty-big">
    ${raw(icon("inbox"))}
    <div>Nothing open in this view.</div>
  </div>`;
}

function renderChanges(history: HistoryEvent[], visibleKeys: Set<string>) {
  const cutoff = sessionCutoff ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const events = history
    .filter((e) => e.at >= cutoff && visibleKeys.has(e.prKey))
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  if (events.length === 0) {
    els.changes.innerHTML = html`<section class="panel changes-panel">
      <div class="panel-head"><h2 class="panel-title">Changes</h2></div>
      <div class="empty">Nothing has moved since your last visit.</div>
    </section>`;
    return;
  }

  const rows = events
    .map((e) => {
      const from = e.from ? statusMeta(e.from) : null;
      const to = e.to ? statusMeta(e.to) : null;
      const fromLabel = from ? from.label : "New PR";
      const toLabel = to ? to.label : "Merged or closed";
      return html`<button type="button" class="change-row" data-pr-key="${e.prKey}" title="${e.prTitle}">
        <span>
          <span class="change-ref">${raw(escapeHtml(shortKey(e.prKey)))}</span>
          <span class="change-flow">
            ${raw(from ? swatch(from) : "")}${fromLabel}
            <span class="arrow">→</span>
            ${raw(to ? swatch(to) : "")}<span class="to">${toLabel}</span>
          </span>
        </span>
        <span class="change-when">${raw(shortAge(e.at))}</span>
      </button>`;
    })
    .join("");

  els.changes.innerHTML = html`<section class="panel changes-panel">
    <div class="panel-head">
      <h2 class="panel-title">Changes</h2>
      <span class="panel-count">${events.length}</span>
    </div>
    <p class="panel-desc">${raw(sessionCutoff ? "Since your last visit." : "In the last 24 hours.")}</p>
    <div class="panel-body">${raw(rows)}</div>
  </section>`;
}

function nodeBadge(x: number, y: number, text: string): string {
  return `<g class="node-badge">
      <circle cx="${x}" cy="${y}" r="9" />
      <text x="${x}" y="${y + 3.5}">${escapeHtml(text)}</text>
    </g>`;
}

function wideNode({ pr, x, y, width, height, badge }: NodeBox): string {
  const meta = statusMeta(pr.status);
  const dash = pr.manuallyLinked ? ' stroke-dasharray="4 3"' : "";
  const textX = x + 14;
  return `
    <g class="node-g" data-pr-key="${escapeHtml(pr.key)}">
      <rect class="node-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="7"${dash} />
      <rect class="${markClass("node-rail", meta)}" style="color:${meta.color}" x="${x}" y="${y}" width="3" height="${height}" rx="1.5" />
      <text class="node-ref" x="${textX}" y="${y + 19}">${escapeHtml(shortRef(pr))}</text>
      <circle class="${markClass("node-dot", meta)}" style="color:${meta.color}" cx="${textX + 3}" cy="${y + 33}" r="3.5" />
      <text class="node-meta" x="${textX + 12}" y="${y + 36}">${escapeHtml(meta.label)}</text>
      <text class="node-meta" x="${textX}" y="${y + 52}">${escapeHtml(shortAge(pr.createdAt))} · +${pr.additions}/−${pr.deletions} · ${pr.changedFiles}f</text>
      ${nodeBadge(x + width - 14, y + 14, badge)}
      ${pr.isSpecPR ? `<text class="node-tag" x="${textX}" y="${y - 6}">SPEC</text>` : ""}
    </g>`;
}

function wideDiagram({ busY, nodes }: DiagramLayout): string {
  const ordered = nodes.some((n) => n.pr.isSpecPR);
  const busClass = ordered ? "bus" : "bus-dashed";
  const centers = nodes.map((n) => n.x + n.width / 2);
  const stems = nodes.map((n, i) => {
    const cx = centers[i];
    return n.pr.isSpecPR
      ? `<line x1="${cx}" y1="${n.y + n.height}" x2="${cx}" y2="${busY}" class="bus" /><circle cx="${cx}" cy="${busY}" r="3" class="bus-dot" />`
      : `<line x1="${cx}" y1="${busY}" x2="${cx}" y2="${n.y}" class="${busClass}" />`;
  });
  const bus = `<line x1="${Math.min(...centers)}" y1="${busY}" x2="${Math.max(...centers)}" y2="${busY}" class="${busClass}" stroke-width="2" />`;
  return bus + stems.join("") + nodes.map(wideNode).join("");
}

function verticalNode({ pr, x, y, width, height, badge }: NodeBox): string {
  const meta = statusMeta(pr.status);
  const dash = pr.manuallyLinked ? ' stroke-dasharray="4 3"' : "";
  return `
    <g class="node-g" data-pr-key="${escapeHtml(pr.key)}">
      <rect class="node-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"${dash} />
      <rect class="${markClass("node-rail", meta)}" style="color:${meta.color}" x="${x}" y="${y}" width="3" height="${height}" rx="1.5" />
      <text class="node-ref" x="${x + 12}" y="${y + 14}">${escapeHtml(shortRef(pr))}</text>
      <text class="node-meta" x="${x + 12}" y="${y + 27}">${escapeHtml(meta.label)} · ${escapeHtml(shortAge(pr.createdAt))} · +${pr.additions}/−${pr.deletions}</text>
      <line x1="${V_BUS_X}" y1="${y + height / 2}" x2="${x}" y2="${y + height / 2}" class="bus" />
      ${nodeBadge(V_BUS_X, y + height / 2, badge)}
    </g>`;
}

function verticalDiagram(set: ChangeSet, { nodes }: DiagramLayout): string {
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const busClass = set.mergeOrderKnown ? "bus" : "bus-dashed";
  const bus = `<line x1="${V_BUS_X}" y1="${first.y + first.height / 2}" x2="${V_BUS_X}" y2="${last.y + last.height / 2}" class="${busClass}" stroke-width="2" />`;
  return bus + nodes.map(verticalNode).join("");
}

function setDiagram(set: ChangeSet, avail: number): string {
  const specs = set.members.filter((m) => m.isSpecPR);
  const consumers = set.members.filter((m) => !m.isSpecPR);
  const layout = diagramLayout(set, avail);
  const svg = layout.orientation === "wide" ? wideDiagram(layout) : verticalDiagram(set, layout);
  const { height } = layout;

  const caption = set.mergeOrderKnown
    ? `step 1: ${plural(specs.length, "spec PR", "spec PRs")} → step 2: ${plural(consumers.length, "consumer", "consumers")} · any order within a step`
    : "no spec PR in this set — nothing says which goes first";

  return html`<div class="diagram">
    <div class="diagram-head">
      <span class="diagram-label">${set.label}</span>
      <span class="diagram-count">${plural(set.members.length, "PR", "PRs")}</span>
      <span class="set-spacer"></span>
      ${raw(set.hasManualLink ? html`<span class="chip chip-linked">has manual link</span>` : "")}
      ${raw(statusChip(set.status))}
    </div>
    <div class="diagram-caption">${caption}</div>
    <svg viewBox="0 0 ${avail} ${height}" width="${avail}" height="${height}" role="img" aria-label="Change set ${set.label}">
      ${raw(svg)}
    </svg>
  </div>`;
}

function renderConnections(sets: ChangeSet[]) {
  const multi = sets.filter((s) => s.members.length > 1);
  const solo = sets.filter((s) => s.members.length === 1).length;
  const soloNote = solo > 0
    ? html`<div class="solo-note">${plural(solo, "PR ships", "PRs ship")} on ${raw(solo === 1 ? "its" : "their")} own, connected to nothing.</div>`
    : "";

  if (multi.length === 0) {
    els.connections.innerHTML = html`<section class="panel">
      <div class="panel-head has-rule"><h2 class="panel-title">Connections</h2></div>
      <div class="empty">No multi-repo change sets right now — nothing has to merge in a particular order.</div>
      ${raw(soloNote)}
    </section>`;
    return;
  }

  const avail = Math.max(300, Math.round((els.connections.clientWidth || 1200) - 34));

  els.connections.innerHTML = html`<section class="panel">
    <div class="panel-head has-rule">
      <h2 class="panel-title">Connections</h2>
      <span class="panel-count">${plural(multi.length, "change set", "change sets")}</span>
      <span class="set-spacer"></span>
      <span class="panel-hint">PRs that ship together. Merge down the bus, never across it.</span>
    </div>
    ${raw(multi.map((s) => setDiagram(s, avail)).join(""))}
    ${raw(soloNote)}
  </section>`;
}

for (const el of [els.buckets, els.changes, els.connections]) {
  el.addEventListener("click", (e) => {
    const node = e.target instanceof Element ? e.target.closest("[data-pr-key]") : null;
    if (node) openDrawer(node.getAttribute("data-pr-key"));
  });
}

function findPr(prKey: string | null): DerivedPullRequest | null {
  return appState?.prs.find((p) => p.key === prKey) ?? null;
}

let lastFocused: HTMLElement | null = null;
let descriptionExpanded = false;

function focusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function openDrawer(prKey: string | null) {
  if (!findPr(prKey)) return;
  lastFocused = focusedElement();
  if (prKey !== drawerPrKey) descriptionExpanded = false;
  drawerPrKey = prKey;
  renderDrawer();
  els.drawer.focus();
}

function closeDrawer() {
  drawerPrKey = null;
  els.drawer.classList.add("hidden");
  els.scrim.classList.add("hidden");
  if (lastFocused?.isConnected) lastFocused.focus();
  lastFocused = null;
}

els.scrim.addEventListener("click", () => {
  if (settingsOpen) closeSettings();
  else closeDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (settingsOpen) closeSettings();
  else if (drawerPrKey) closeDrawer();
});

let noteSaveTimer: number | undefined;
function scheduleNoteSave(prKey: string, text: string, hintEl: HTMLElement) {
  clearTimeout(noteSaveTimer);
  hintEl.textContent = "Saving…";
  noteSaveTimer = setTimeout(async () => {
    const state = await requestState(`/api/notes/${encodeURIComponent(prKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!state) {
      hintEl.textContent = "Could not save note.";
      return;
    }
    appState = state;
    hintEl.textContent = text.trim() === "" ? "Note cleared." : "Saved.";
    render({ skipDrawer: true });
  }, 800);
}

async function handleLinkChange(prKey: string, value: string) {
  const state = value === "__branch__"
    ? await requestState(`/api/links/${encodeURIComponent(prKey)}`, { method: "DELETE" })
    : await requestState("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prKey, targetSetKey: value }),
      });
  if (state) appState = state;
  // On failure too: re-rendering from the last good state puts the link picker back on the saved set.
  render();
}

const CHECK_OK = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const OWNER_LABEL: Record<Owner, string> = { you: "You", author: "The author", reviewers: "Reviewers" };

function renderDrawer() {
  if (!appState || !drawerPrKey) return;
  const pr = findPr(drawerPrKey);
  if (!pr) return;

  els.scrim.classList.remove("hidden");
  els.drawer.classList.remove("hidden");

  const meta = statusMeta(pr.status);
  const note = appState.notes[pr.key];
  const set = appState.sets.find((s) => s.members.some((m) => m.key === pr.key));

  const linkOptions = appState.sets
    .filter((s) => s.key !== pr.branchSetKey)
    .map((s) => html`<option value="${s.key}" ${raw(pr.setKey === s.key ? "selected" : "")}>${s.label} — ${s.key}</option>`)
    .join("");

  const checksHtml = pr.checks.length
    ? pr.checks
        .map((c) => {
          const ok = CHECK_OK.has(c.state.toUpperCase());
          const failed = c.state.toUpperCase() === "FAILURE";
          const color = ok ? "var(--sig-good)" : failed ? "var(--sig-bad)" : "var(--ink-muted)";
          const ic = ok ? "check" : failed ? "xCircle" : "clock";
          return html`<div class="list-row"><span style="color:${raw(color)};display:flex">${raw(icon(ic))}</span><span class="name">${c.name}</span><span class="state">${c.state}</span></div>`;
        })
        .join("")
    : html`<div class="empty">No CI checks on this PR.</div>`;

  const reviewsHtml = pr.reviews.length
    ? pr.reviews
        .map((r) => {
          const approved = r.state === "APPROVED";
          const changes = r.state === "CHANGES_REQUESTED";
          const color = approved ? "var(--sig-good)" : changes ? "var(--sig-warn)" : "var(--ink-muted)";
          const ic = approved ? "check" : changes ? "cornerUpLeft" : "note";
          const stale = approved && r.commitSha && r.commitSha !== pr.headCommitSha;
          return html`<div class="list-row"><span style="color:${raw(color)};display:flex">${raw(icon(ic))}</span><span class="name">${r.author}</span><span class="state">${raw(stale ? "approved an older commit" : escapeHtml(r.state.toLowerCase().replace(/_/g, " ")))}</span></div>`;
        })
        .join("")
    : html`<div class="empty">No reviews yet.</div>`;

  const descriptionHtml = pr.body.trim()
    ? html`<p class="description ${raw(descriptionExpanded ? "" : "is-clamped")}" id="description-text">${pr.body.trim()}</p>
      <button type="button" class="link-btn" id="description-toggle" hidden>${raw(descriptionExpanded ? "Show less" : "Show more")}</button>`
    : html`<div class="empty">No description.</div>`;

  const mentionsHtml = pr.mentions
    .map((key) => findPr(key))
    .filter((m) => m != null)
    .map((m) => {
      const mm = statusMeta(m.status);
      const sameSet = m.setKey === pr.setKey;
      const action = sameSet
        ? html`<span class="state chip chip-meta">same set</span>`
        : html`<button type="button" class="btn btn-small" data-join-set="${m.setKey}">Join its set</button>`;
      return html`<div class="mention-row">
        <span style="color:${raw(mm.color)};display:flex" title="${mm.label}">${raw(icon(mm.icon))}</span>
        <button type="button" class="mention-ref" data-member-key="${m.key}">${raw(escapeHtml(shortRef(m)))}</button>
        <span class="mention-title" title="${m.title}">${m.title}</span>
        ${raw(action)}
      </div>`;
    })
    .join("");

  const membersHtml = set && set.members.length > 1
    ? set.members
        .map((m) => {
          const mm = statusMeta(m.status);
          return html`<button type="button" class="member-row ${raw(m.key === pr.key ? "is-current" : "")}" data-member-key="${m.key}">
            <span class="step" title="${raw(m.mergeStep == null ? "order unknown" : `merge step ${m.mergeStep}`)}">${raw(stepOf(m))}</span>
            <span style="color:${raw(mm.color)};display:flex">${raw(icon(mm.icon))}</span>
            <span class="name">${raw(escapeHtml(shortRef(m)))}</span>
            <span class="state chip chip-meta">${mm.label}</span>
          </button>`;
        })
        .join("")
    : "";

  els.drawer.innerHTML = html`
    <div class="drawer-head">
      <div class="drawer-top">
        <span style="color:${raw(meta.color)};display:flex">${raw(icon(meta.icon))}</span>
        ${raw(statusChip(pr.status))}
        ${raw(pr.authorIsBot ? html`<span class="chip chip-bot">bot</span>` : "")}
        ${raw(pr.manuallyLinked ? html`<span class="chip chip-linked">linked</span>` : "")}
        <button class="drawer-close" id="drawer-close-btn" aria-label="Close">${raw(icon("x"))}</button>
      </div>
      <h2 class="drawer-title">${pr.title}</h2>
      <a class="drawer-link" href="${pr.url}" target="_blank" rel="noopener">${raw(escapeHtml(pr.repo))}#${pr.number} on GitHub ${raw(icon("externalLink"))}</a>
    </div>

    <div class="drawer-body">
      <div class="field">
        <span class="field-label">Description</span>
        ${raw(descriptionHtml)}
      </div>

      ${raw(mentionsHtml ? html`<div class="field">
        <span class="field-label">Mentions</span>
        <div class="field-hint" style="margin:0 0 4px">PRs this description refers to. Joining one is a manual link, same as picking it below.</div>
        ${raw(mentionsHtml)}
      </div>` : "")}

      <div class="field">
        <label class="field-label" for="note-input">Note</label>
        <textarea id="note-input" placeholder="Why is this stuck? What was agreed?">${raw(escapeHtml(note?.text ?? ""))}</textarea>
        <div class="field-hint" id="note-hint">${raw(note ? `Saved ${escapeHtml(timeAgo(note.savedAt))}.` : "Saves automatically. Clearing the text deletes the note.")}</div>
      </div>

      <div class="field">
        <label class="field-label" for="link-select">Change set</label>
        <select id="link-select">
          <option value="__branch__" ${raw(!pr.manuallyLinked ? "selected" : "")}>By branch name — ${pr.branchSetKey}</option>
          ${raw(linkOptions)}
        </select>
        <div class="field-hint">${raw(pr.manuallyLinked ? "Manually linked. Switch back to the branch name to unlink." : "Grouped by head branch name. Pick another set to link it by hand.")}</div>
      </div>

      <div class="field">
        <span class="field-label">State</span>
        <dl class="facts">
          <dt>Next move</dt><dd>${raw(OWNER_LABEL[pr.owner] ?? escapeHtml(pr.owner))}</dd>
          <dt>Author</dt><dd>${pr.author}</dd>
          <dt>Branch</dt><dd>${pr.headRefName} → ${pr.baseRefName}</dd>
          <dt>Size</dt><dd class="mono">+${pr.additions} / −${pr.deletions} · ${plural(pr.changedFiles, "file", "files")}</dd>
          <dt>Opened</dt><dd>${timeAgo(pr.createdAt)}</dd>
          <dt>Last activity</dt><dd>${timeAgo(pr.lastActivityAt)}</dd>
          <dt>Mergeable</dt><dd>${raw(escapeHtml(pr.mergeableState.toLowerCase()))}</dd>
          <dt>Spec PR</dt><dd>${raw(pr.isSpecPR ? "yes" : "no")}</dd>
        </dl>
      </div>

      <div class="field">
        <span class="field-label">CI checks</span>
        ${raw(checksHtml)}
      </div>

      <div class="field">
        <span class="field-label">Reviews</span>
        ${raw(reviewsHtml)}
      </div>

      ${raw(set && membersHtml ? html`<div class="field">
        <span class="field-label">Change set — ${set.label}${raw(set.mergeOrderKnown ? " (merge steps)" : " (order unknown)")}</span>
        ${raw(membersHtml)}
      </div>` : "")}
    </div>`;

  const hint = byId("note-hint", HTMLElement);
  const noteInput = byId("note-input", HTMLTextAreaElement);
  const linkSelect = byId("link-select", HTMLSelectElement);
  byId("drawer-close-btn", HTMLButtonElement).addEventListener("click", closeDrawer);
  noteInput.addEventListener("input", () => scheduleNoteSave(pr.key, noteInput.value, hint));
  linkSelect.addEventListener("change", () => handleLinkChange(pr.key, linkSelect.value));
  els.drawer.querySelectorAll("[data-member-key]").forEach((row) => {
    row.addEventListener("click", () => openDrawer(row.getAttribute("data-member-key")));
  });
  els.drawer.querySelectorAll("[data-join-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-join-set");
      if (target) handleLinkChange(pr.key, target === pr.branchSetKey ? "__branch__" : target);
    });
  });

  const descText = document.getElementById("description-text");
  const descToggle = document.getElementById("description-toggle");
  if (descText && descToggle) {
    if (descriptionExpanded || descText.scrollHeight > descText.clientHeight + 1) descToggle.hidden = false;
    descToggle.addEventListener("click", () => {
      descriptionExpanded = !descriptionExpanded;
      renderDrawer();
    });
  }
}

let settingsOpen = false;

// The drawer is one form. Nothing in it takes effect until Save — the theme included, even
// though it is stored in the browser — so every section has the same contract. Reset fills the
// form with the defaults and still needs a Save.
function readSettingsForm(): Settings {
  const checkedTheme = document.querySelector('input[name="theme"]:checked');
  return {
    theme: checkedTheme instanceof HTMLInputElement ? checkedTheme.value : "auto",
    notify: byId("notify-on", HTMLInputElement).checked,
    specRule: {
      useRepoSuffix: byId("rule-suffix-on", HTMLInputElement).checked,
      repoSuffixes: splitWords(byId("rule-suffixes", HTMLInputElement).value),
      useFileKeywords: byId("rule-files-on", HTMLInputElement).checked,
      fileKeywords: splitWords(byId("rule-keywords", HTMLInputElement).value),
    },
  };
}

function savedSettings(state: StatePayload): Settings {
  return { theme: currentTheme().key, notify: state.notify, specRule: state.specRule };
}

function fillSettingsForm({ theme, notify, specRule }: Settings) {
  for (const input of byId("theme-picker", HTMLElement).querySelectorAll("input")) input.checked = input.value === theme;
  byId("notify-on", HTMLInputElement).checked = notify;
  byId("rule-suffix-on", HTMLInputElement).checked = specRule.useRepoSuffix;
  byId("rule-suffixes", HTMLInputElement).value = specRule.repoSuffixes.join(", ");
  byId("rule-files-on", HTMLInputElement).checked = specRule.useFileKeywords;
  byId("rule-keywords", HTMLInputElement).value = specRule.fileKeywords.join(", ");
  updateSettingsForm();
}

// Re-derives everything that depends on the form's current values: the theme segment highlight,
// the spec-rule preview, the disabled inputs, and whether Save has anything to save.
function updateSettingsForm() {
  if (!settingsOpen || !appState) return;
  const form = readSettingsForm();
  for (const seg of document.querySelectorAll("#theme-picker .segment")) seg.classList.toggle("is-on", seg.querySelector("input")?.value === form.theme);
  byId("theme-hint", HTMLElement).textContent = themeFor(form.theme).hint;

  const rule = form.specRule;
  const preview = byId("rule-preview", HTMLElement);
  const prs = appState.prs;
  const inactive = (!rule.useRepoSuffix || rule.repoSuffixes.length === 0) && (!rule.useFileKeywords || rule.fileKeywords.length === 0);
  if (inactive) {
    preview.innerHTML = html`${raw(icon("alertCircle"))}Nothing matches — no PR will count as a spec PR, so every set's merge order becomes unknown.`;
    preview.className = "rule-preview is-warning";
  } else {
    const n = prs.filter((pr) => previewSpecMatch(pr, rule)).length;
    preview.textContent = `Would mark ${n} of ${plural(prs.length, "open PR", "open PRs")} as spec PRs.`;
    preview.className = "rule-preview";
  }
  byId("rule-suffixes", HTMLInputElement).disabled = !rule.useRepoSuffix;
  byId("rule-keywords", HTMLInputElement).disabled = !rule.useFileKeywords;

  const dirty = !sameSettings(form, savedSettings(appState));
  byId("settings-save", HTMLButtonElement).disabled = !dirty;
  const hint = byId("settings-hint", HTMLElement);
  if (!hint.dataset.sticky) hint.textContent = dirty ? "Unsaved changes." : "";
}

function renderSettings() {
  if (!appState) return;
  const { specRule: rule, defaults } = appState;
  const theme = currentTheme();
  els.settings.innerHTML = html`<div class="drawer-head">
      <div class="drawer-top">
        <button type="button" class="drawer-close" id="settings-close-btn" aria-label="Close">${raw(icon("x"))}</button>
      </div>
      <h2 class="drawer-title">Settings</h2>
      <p class="settings-intro">Changes apply when you save.</p>
    </div>
    <div class="drawer-body">
      <section class="settings-section" aria-labelledby="appearance-title">
        <h3 class="settings-section-title" id="appearance-title">Appearance</h3>
        <p class="settings-intro">Colour theme for this browser — remembered here only.</p>
        <div class="segmented" role="radiogroup" aria-label="Colour theme" id="theme-picker">
          ${raw(THEMES.map((t) => html`<label class="segment${t.key === theme.key ? " is-on" : ""}">
            <input type="radio" name="theme" value="${t.key}" ${raw(t.key === theme.key ? "checked" : "")} />
            ${raw(icon(t.icon))}<span>${t.label}</span>
          </label>`).join(""))}
        </div>
        <div class="field-hint" id="theme-hint">${theme.hint}</div>
      </section>

      <section class="settings-section" aria-labelledby="notify-title">
        <h3 class="settings-section-title" id="notify-title">Notifications</h3>
        <p class="settings-intro">One desktop notification per scan, only when something changed.</p>
        <label class="check-row settings-toggle"><input type="checkbox" id="notify-on" ${raw(appState.notify ? "checked" : "")} /> Desktop notification when a PR changes status</label>
      </section>

      <section class="settings-section" aria-labelledby="spec-rule-title">
        <h3 class="settings-section-title" id="spec-rule-title">Spec PR rule</h3>
        <p class="settings-intro">A PR is a spec PR when either rule below matches. Spec PRs are merge step 1; everything else in their set is step 2. Words are comma-separated and case doesn't matter.</p>
        <div class="field">
          <label class="check-row"><input type="checkbox" id="rule-suffix-on" ${raw(rule.useRepoSuffix ? "checked" : "")} /> Repository name ends with</label>
          <input type="text" id="rule-suffixes" value="${rule.repoSuffixes.join(", ")}" placeholder="-openapi" spellcheck="false" autocomplete="off" />
          <div class="field-hint">e.g. <code>billing-openapi</code> matches <code>-openapi</code>.</div>
        </div>
        <div class="field">
          <label class="check-row"><input type="checkbox" id="rule-files-on" ${raw(rule.useFileKeywords ? "checked" : "")} /> A changed file's name contains</label>
          <input type="text" id="rule-keywords" value="${rule.fileKeywords.join(", ")}" placeholder="openapi, swagger" spellcheck="false" autocomplete="off" />
          <div class="field-hint">Matched against the full path, e.g. <code>docs/swagger.yaml</code> matches <code>swagger</code>.</div>
        </div>
        <div id="rule-preview" class="rule-preview"></div>
      </section>
    </div>
    <div class="drawer-foot">
      <button type="button" class="btn btn-quiet" id="settings-reset">Reset to defaults</button>
      <span class="field-hint" id="settings-hint"></span>
      <button type="button" class="btn" id="settings-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="settings-save">Save</button>
    </div>`;

  byId("settings-close-btn", HTMLButtonElement).addEventListener("click", closeSettings);
  byId("settings-save", HTMLButtonElement).addEventListener("click", saveSettings);
  byId("settings-cancel", HTMLButtonElement).addEventListener("click", closeSettings);
  byId("settings-reset", HTMLButtonElement).addEventListener("click", () => {
    fillSettingsForm({ theme: "auto", notify: defaults.notify, specRule: defaults.specRule });
  });
  updateSettingsForm();
}

async function saveSettings() {
  const form = readSettingsForm();
  const hint = byId("settings-hint", HTMLElement);
  hint.dataset.sticky = "1";
  hint.textContent = "Saving…";
  byId("settings-save", HTMLButtonElement).disabled = true;
  const state = await requestState("/api/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ notify: form.notify, specRule: form.specRule }),
  });
  if (!state) {
    hint.textContent = "Could not save settings.";
    byId("settings-save", HTMLButtonElement).disabled = false;
    setTimeout(() => { delete hint.dataset.sticky; if (settingsOpen) updateSettingsForm(); }, 2500);
    return;
  }
  appState = state;
  setTheme(form.theme);
  render({ skipDrawer: true });
  renderSettings();
  const h = byId("settings-hint", HTMLElement);
  h.dataset.sticky = "1";
  h.textContent = "Saved.";
  setTimeout(() => { delete h.dataset.sticky; if (settingsOpen) updateSettingsForm(); }, 2500);
}

function openSettings() {
  if (drawerPrKey) closeDrawer();
  settingsOpen = true;
  lastFocused = focusedElement();
  renderSettings();
  els.settings.classList.remove("hidden");
  els.scrim.classList.remove("hidden");
  els.settings.focus();
}

function closeSettings() {
  settingsOpen = false;
  els.settings.classList.add("hidden");
  els.scrim.classList.add("hidden");
  if (lastFocused?.isConnected) lastFocused.focus();
  lastFocused = null;
}

els.settingsBtn.addEventListener("click", openSettings);
// Delegated once on the drawer element: renderSettings() rebuilds its contents on every open and save.
els.settings.addEventListener("input", updateSettingsForm);
els.settings.addEventListener("change", updateSettingsForm);

let resizeTimer: number | undefined;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => render({ skipDrawer: drawerPrKey != null }), 150);
});

fetchState();
setInterval(() => fetchState({ skipDrawer: drawerPrKey != null }), POLL_MS);
