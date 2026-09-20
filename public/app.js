const POLL_MS = 20000;
const LAST_VISIT_KEY = "prManagerLastVisit";

const sessionCutoff = localStorage.getItem(LAST_VISIT_KEY);
localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());

const ICON_PATHS = {
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

function icon(name, cls = "") {
  const d = ICON_PATHS[name];
  if (!d) return "";
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

const STATUS_META = {
  // Colour is per action class (see the token comment in styles.css): statuses that share a
  // class share a hue and are told apart by icon + label. DRAFT is hollow: an outline, not a
  // fill, so its grey never competes with the chromatic steps.
  DRAFT: { label: "Draft", color: "var(--cls-neutral)", icon: "edit", hollow: true },
  CONFLICTED: { label: "Conflicted", color: "var(--cls-blocked)", icon: "alertTriangle" },
  CI_FAILING: { label: "CI failing", color: "var(--cls-blocked)", icon: "xCircle" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "var(--cls-blocked)", icon: "cornerUpLeft" },
  REVIEW_STALE: { label: "Review stale", color: "var(--cls-info)", icon: "rotateCw" },
  READY_TO_MERGE: { label: "Ready to merge", color: "var(--cls-success)", icon: "checkCircle" },
  STALE: { label: "Rotting", color: "var(--cls-stale)", icon: "clock" },
  NEEDS_REVIEW: { label: "Needs review", color: "var(--cls-info)", icon: "eye" },
};

const STATUS_ORDER = Object.keys(STATUS_META);

function statusMeta(status) {
  return STATUS_META[status] ?? { label: status, color: "var(--ink-muted)", icon: "alertCircle" };
}

class Raw {
  constructor(value) { this.value = value; }
}
function raw(value) { return new Raw(value); }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
function html(strings, ...values) {
  return strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? (values[i] instanceof Raw ? values[i].value : escapeHtml(values[i])) : ""),
    "",
  );
}

function timeAgo(iso) {
  if (!iso) return "unknown";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(0, Math.floor(ms / 60000));
  return `${mins}m ago`;
}

function shortAge(iso) {
  if (!iso) return "?";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(0, Math.floor(ms / 60000))}m`;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function shortRef(pr) {
  return `${pr.repoName ?? pr.repo}#${pr.number}`;
}

function shortKey(prKey) {
  return prKey.includes("/") ? prKey.slice(prKey.indexOf("/") + 1) : prKey;
}

let appState = null;
let currentView = new URLSearchParams(location.search).get("view") || "overview";
let drawerPrKey = null;

const els = {
  scanMeta: document.getElementById("scan-meta"),
  errorBanner: document.getElementById("error-banner"),
  summary: document.getElementById("summary"),
  changes: document.getElementById("changes-section"),
  connections: document.getElementById("connections-section"),
  buckets: document.getElementById("buckets-section"),
  drawer: document.getElementById("drawer"),
  scrim: document.getElementById("drawer-scrim"),
  refreshBtn: document.getElementById("refresh-btn"),
  refreshIcon: document.getElementById("refresh-icon"),
  refreshLabel: document.getElementById("refresh-label"),
  settings: document.getElementById("settings"),
  settingsBtn: document.getElementById("settings-btn"),
  tabs: document.getElementById("tabs"),
  shell: document.getElementById("main"),
};

els.refreshIcon.innerHTML = icon("rotateCw");
document.getElementById("settings-icon").innerHTML = icon("sliders");

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
function currentTheme() {
  let key = null;
  try { key = localStorage.getItem(THEME_KEY); } catch {}
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
function setTheme(key) {
  const theme = THEMES.find((t) => t.key === key) ?? THEMES[0];
  try {
    if (theme.key === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme.key);
  } catch {}
  if (theme.key === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme.key;
  return theme;
}

async function fetchState({ skipDrawer = false } = {}) {
  const res = await fetch("/api/state");
  appState = await res.json();
  render({ skipDrawer });
}

async function refresh() {
  els.refreshBtn.disabled = true;
  els.refreshLabel.textContent = "Scanning…";
  els.shell.classList.add("is-refetching");
  try {
    const res = await fetch("/api/refresh", { method: "POST" });
    appState = await res.json();
    render({ skipDrawer: drawerPrKey != null });
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshLabel.textContent = "Refresh";
    els.shell.classList.remove("is-refetching");
  }
}

els.refreshBtn.addEventListener("click", refresh);

els.tabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view]");
  if (!btn) return;
  currentView = btn.dataset.view;
  const url = new URL(location.href);
  url.searchParams.set("view", currentView);
  history.pushState({}, "", url);
  render();
});

window.addEventListener("popstate", () => {
  currentView = new URLSearchParams(location.search).get("view") || "overview";
  render();
});

function setMatchesView(set, view, viewerLogin) {
  if (view === "overview") return true;
  if (!viewerLogin) return false;
  if (view === "mine") return set.members.some((m) => m.author === viewerLogin);
  if (view === "review") return set.members.some((m) => (m.requestedReviewers || []).includes(viewerLogin));
  return true;
}

function visibleSets() {
  if (!appState) return [];
  const viewerLogin = appState.meta?.ranAs ?? null;
  return appState.sets.filter((s) => setMatchesView(s, currentView, viewerLogin));
}

function countForView(view) {
  if (!appState) return 0;
  const viewerLogin = appState.meta?.ranAs ?? null;
  const sets = appState.sets.filter((s) => setMatchesView(s, view, viewerLogin));
  return new Set(sets.flatMap((s) => s.members.map((m) => m.key))).size;
}

function render({ skipDrawer = false } = {}) {
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
  renderChanges(new Set(prs.map((p) => p.key)));
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
    btn.classList.toggle("is-active", btn.dataset.view === currentView);
  }
  for (const [view, id] of [["overview", "count-overview"], ["mine", "count-mine"], ["review", "count-review"]]) {
    document.getElementById(id).textContent = appState?.meta ? countForView(view) : "";
  }
}

function renderSummary(sets, prs) {
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

function swatch(meta) {
  return meta.hollow
    ? `<span class="swatch swatch-hollow" style="color:${meta.color}"></span>`
    : `<span class="swatch" style="background:${meta.color}"></span>`;
}

// Class list for an SVG status mark (.node-rail / .node-dot); the CSS turns hollow into an outline.
function markClass(base, meta) {
  return meta.hollow ? `${base} is-hollow` : base;
}

function statusChip(status) {
  const meta = statusMeta(status);
  return html`<span class="chip chip-status">${raw(swatch(meta))}${meta.label}</span>`;
}

function prRow(pr) {
  const meta = statusMeta(pr.status);
  const note = appState.notes[pr.key];
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

function setCard(set) {
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

const BUCKETS = [
  { key: "bot", rank: 5, title: "Bot PRs", desc: "Automated PRs. Out of the way, but not hidden.", icon: "bot", match: (s) => s.members.every((m) => m.authorIsBot) },
  { key: "ready", rank: 1, title: "Ready to merge", desc: "Approved, mergeable, checks green. Go merge it.", icon: "checkCircle", match: (s) => s.status === "READY_TO_MERGE" },
  { key: "draft", rank: 4, title: "Drafts", desc: "Not ready for review yet.", icon: "edit", match: (s) => s.status === "DRAFT" },
  { key: "rotting", rank: 2, title: "Rotting", desc: "No activity in over a week. Close it, revive it, or leave a note.", icon: "clock", match: (s) => s.status === "STALE" },
  { key: "you", rank: 0, title: "Waiting on you", desc: "The next move is yours.", icon: "user", match: (s) => s.owner === "you" },
  { key: "reviewers", rank: 3, title: "Waiting on reviewers", desc: "Sitting with someone else for now.", icon: "users", match: (s) => s.owner === "reviewers" },
];

function bucketFor(set) {
  return BUCKETS.find((b) => b.match(set)) ?? null;
}

function renderBuckets(sets) {
  const grouped = new Map(BUCKETS.map((b) => [b.key, []]));
  for (const set of sets) {
    const bucket = bucketFor(set);
    if (bucket) grouped.get(bucket.key).push(set);
  }

  const sections = [...BUCKETS]
    .sort((a, b) => a.rank - b.rank)
    .filter((b) => grouped.get(b.key).length > 0)
    .map((b) => {
      const list = grouped.get(b.key);
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

function renderChanges(visibleKeys) {
  const cutoff = sessionCutoff ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const events = appState.history
    .filter((e) => e.at >= cutoff && visibleKeys.has(e.prKey))
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  if (events.length === 0) {
    els.changes.innerHTML = html`<section class="panel">
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

  els.changes.innerHTML = html`<section class="panel">
    <div class="panel-head">
      <h2 class="panel-title">Changes</h2>
      <span class="panel-count">${events.length}</span>
    </div>
    <p class="panel-desc">${raw(sessionCutoff ? "Since your last visit." : "In the last 24 hours.")}</p>
    <div class="panel-body">${raw(rows)}</div>
  </section>`;
}

const NODE_W = 216;
const NODE_H = 62;
const GAP_X = 18;
const GAP_Y = 26;

const V_NODE_H = 34;
const V_GAP = 9;
const V_BUS_X = 14;
const V_NODE_X = 30;

function stepOf(pr) {
  return pr.mergeStep == null ? "?" : String(pr.mergeStep);
}

function nodeBadge(x, y, text) {
  return `<g class="node-badge">
      <circle cx="${x}" cy="${y}" r="9" />
      <text x="${x}" y="${y + 3.5}">${escapeHtml(text)}</text>
    </g>`;
}

function wideNode(pr, x, y, order) {
  const meta = statusMeta(pr.status);
  const dash = pr.manuallyLinked ? ' stroke-dasharray="4 3"' : "";
  const textX = x + 14;
  return `
    <g class="node-g" data-pr-key="${escapeHtml(pr.key)}">
      <rect class="node-box" x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="7"${dash} />
      <rect class="${markClass("node-rail", meta)}" style="color:${meta.color}" x="${x}" y="${y}" width="3" height="${NODE_H}" rx="1.5" />
      <text class="node-ref" x="${textX}" y="${y + 19}">${escapeHtml(shortRef(pr))}</text>
      <circle class="${markClass("node-dot", meta)}" style="color:${meta.color}" cx="${textX + 3}" cy="${y + 33}" r="3.5" />
      <text class="node-meta" x="${textX + 12}" y="${y + 36}">${escapeHtml(meta.label)}</text>
      <text class="node-meta" x="${textX}" y="${y + 52}">${escapeHtml(shortAge(pr.createdAt))} · +${pr.additions}/−${pr.deletions} · ${pr.changedFiles}f</text>
      ${nodeBadge(x + NODE_W - 14, y + 14, order)}
      ${pr.isSpecPR ? `<text class="node-tag" x="${textX}" y="${y - 6}">SPEC</text>` : ""}
    </g>`;
}

function rowStartX(count, avail) {
  const rowW = count * NODE_W + (count - 1) * GAP_X;
  return Math.max(2, Math.round((avail - rowW) / 2));
}

function wideDiagram(set, avail) {
  const specs = set.members.filter((m) => m.isSpecPR);
  const consumers = set.members.filter((m) => !m.isSpecPR);

  const parts = [];
  const stems = [];
  const centers = [];

  if (specs.length > 0) {
    const specY = 12;
    const busY = specY + NODE_H + GAP_Y / 2;
    const consY = busY + GAP_Y / 2;

    let x = rowStartX(specs.length, avail);
    for (const pr of specs) {
      parts.push(wideNode(pr, x, specY, stepOf(pr)));
      const cx = x + NODE_W / 2;
      centers.push(cx);
      stems.push(`<line x1="${cx}" y1="${specY + NODE_H}" x2="${cx}" y2="${busY}" class="bus" />`);
      stems.push(`<circle cx="${cx}" cy="${busY}" r="3" class="bus-dot" />`);
      x += NODE_W + GAP_X;
    }

    x = rowStartX(consumers.length, avail);
    for (const pr of consumers) {
      parts.push(wideNode(pr, x, consY, stepOf(pr)));
      const cx = x + NODE_W / 2;
      centers.push(cx);
      stems.push(`<line x1="${cx}" y1="${busY}" x2="${cx}" y2="${consY}" class="bus" />`);
      x += NODE_W + GAP_X;
    }

    const bus = `<line x1="${Math.min(...centers)}" y1="${busY}" x2="${Math.max(...centers)}" y2="${busY}" class="bus" stroke-width="2" />`;
    return { svg: bus + stems.join("") + parts.join(""), height: consY + NODE_H + 6 };
  }

  const busY = 14;
  const rowY = busY + GAP_Y / 2;
  let x = rowStartX(set.members.length, avail);
  for (const pr of set.members) {
    parts.push(wideNode(pr, x, rowY, "?"));
    const cx = x + NODE_W / 2;
    centers.push(cx);
    stems.push(`<line x1="${cx}" y1="${busY}" x2="${cx}" y2="${rowY}" class="bus-dashed" />`);
    x += NODE_W + GAP_X;
  }
  const bus = `<line x1="${Math.min(...centers)}" y1="${busY}" x2="${Math.max(...centers)}" y2="${busY}" class="bus-dashed" stroke-width="2" />`;
  return { svg: bus + stems.join("") + parts.join(""), height: rowY + NODE_H + 6 };
}

function verticalNode(pr, y, avail, order) {
  const meta = statusMeta(pr.status);
  const dash = pr.manuallyLinked ? ' stroke-dasharray="4 3"' : "";
  const w = avail - V_NODE_X - 2;
  return `
    <g class="node-g" data-pr-key="${escapeHtml(pr.key)}">
      <rect class="node-box" x="${V_NODE_X}" y="${y}" width="${w}" height="${V_NODE_H}" rx="6"${dash} />
      <rect class="${markClass("node-rail", meta)}" style="color:${meta.color}" x="${V_NODE_X}" y="${y}" width="3" height="${V_NODE_H}" rx="1.5" />
      <text class="node-ref" x="${V_NODE_X + 12}" y="${y + 14}">${escapeHtml(shortRef(pr))}</text>
      <text class="node-meta" x="${V_NODE_X + 12}" y="${y + 27}">${escapeHtml(meta.label)} · ${escapeHtml(shortAge(pr.createdAt))} · +${pr.additions}/−${pr.deletions}</text>
      <line x1="${V_BUS_X}" y1="${y + V_NODE_H / 2}" x2="${V_NODE_X}" y2="${y + V_NODE_H / 2}" class="bus" />
      ${nodeBadge(V_BUS_X, y + V_NODE_H / 2, order)}
    </g>`;
}

function verticalDiagram(set, avail) {
  let y = 6;
  const nodes = set.members.map((pr) => {
    const node = verticalNode(pr, y, avail, stepOf(pr));
    y += V_NODE_H + V_GAP;
    return node;
  });
  const height = y - V_GAP + 6;
  const busClass = set.mergeOrderKnown ? "bus" : "bus-dashed";
  const bus = `<line x1="${V_BUS_X}" y1="${6 + V_NODE_H / 2}" x2="${V_BUS_X}" y2="${height - 6 - V_NODE_H / 2}" class="${busClass}" stroke-width="2" />`;
  return { svg: bus + nodes.join(""), height };
}

function setDiagram(set, avail) {
  const specs = set.members.filter((m) => m.isSpecPR);
  const consumers = set.members.filter((m) => !m.isSpecPR);
  const perRow = Math.max(1, Math.floor((avail + GAP_X) / (NODE_W + GAP_X)));
  const fitsWide = avail >= 480 && specs.length <= perRow && consumers.length <= perRow && set.members.length <= perRow * 2;

  const { svg, height } = fitsWide ? wideDiagram(set, avail) : verticalDiagram(set, avail);

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

function renderConnections(sets) {
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
    const node = e.target.closest("[data-pr-key]");
    if (node) openDrawer(node.dataset.prKey);
  });
}

function findPr(prKey) {
  return appState?.prs.find((p) => p.key === prKey) ?? null;
}

let lastFocused = null;
let descriptionExpanded = false;

function openDrawer(prKey) {
  if (!findPr(prKey)) return;
  lastFocused = document.activeElement;
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

let noteSaveTimer = null;
function scheduleNoteSave(prKey, text, hintEl) {
  clearTimeout(noteSaveTimer);
  if (hintEl) hintEl.textContent = "Saving…";
  noteSaveTimer = setTimeout(async () => {
    const res = await fetch(`/api/notes/${encodeURIComponent(prKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    appState = await res.json();
    if (hintEl) hintEl.textContent = text.trim() === "" ? "Note cleared." : "Saved.";
    render({ skipDrawer: true });
  }, 800);
}

async function handleLinkChange(prKey, value) {
  if (value === "__branch__") {
    await fetch(`/api/links/${encodeURIComponent(prKey)}`, { method: "DELETE" });
  } else {
    await fetch("/api/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prKey, targetSetKey: value }),
    });
  }
  await fetchState();
}

const CHECK_OK = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const OWNER_LABEL = { you: "You", author: "The author", reviewers: "Reviewers" };

function renderDrawer() {
  if (!drawerPrKey) return;
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

      ${raw(membersHtml ? html`<div class="field">
        <span class="field-label">Change set — ${set.label}${raw(set.mergeOrderKnown ? " (merge steps)" : " (order unknown)")}</span>
        ${raw(membersHtml)}
      </div>` : "")}
    </div>`;

  const hint = document.getElementById("note-hint");
  document.getElementById("drawer-close-btn").addEventListener("click", closeDrawer);
  document.getElementById("note-input").addEventListener("input", (e) => scheduleNoteSave(pr.key, e.target.value, hint));
  document.getElementById("link-select").addEventListener("change", (e) => handleLinkChange(pr.key, e.target.value));
  els.drawer.querySelectorAll("[data-member-key]").forEach((row) => {
    row.addEventListener("click", () => openDrawer(row.dataset.memberKey));
  });
  els.drawer.querySelectorAll("[data-join-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.joinSet;
      handleLinkChange(pr.key, target === pr.branchSetKey ? "__branch__" : target);
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

function previewSpecMatch(pr, rule) {
  if (rule.useRepoSuffix) {
    const repo = pr.repoName.toLowerCase();
    if (rule.repoSuffixes.some((sfx) => repo.endsWith(sfx))) return true;
  }
  if (rule.useFileKeywords && rule.fileKeywords.length > 0) {
    return pr.changedFilePaths.some((path) => {
      const lower = path.toLowerCase();
      return rule.fileKeywords.some((kw) => lower.includes(kw));
    });
  }
  return false;
}

function splitWords(text) {
  return [...new Set(text.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean))];
}

function readSettingsForm() {
  return {
    useRepoSuffix: document.getElementById("rule-suffix-on").checked,
    repoSuffixes: splitWords(document.getElementById("rule-suffixes").value),
    useFileKeywords: document.getElementById("rule-files-on").checked,
    fileKeywords: splitWords(document.getElementById("rule-keywords").value),
  };
}

function updateSettingsPreview() {
  const rule = readSettingsForm();
  const preview = document.getElementById("rule-preview");
  const prs = appState?.prs ?? [];
  const inactive = (!rule.useRepoSuffix || rule.repoSuffixes.length === 0) && (!rule.useFileKeywords || rule.fileKeywords.length === 0);
  if (inactive) {
    preview.innerHTML = html`${raw(icon("alertCircle"))}Nothing matches — no PR will count as a spec PR, so every set's merge order becomes unknown.`;
    preview.className = "rule-preview is-warning";
    return;
  }
  const n = prs.filter((pr) => previewSpecMatch(pr, rule)).length;
  preview.textContent = `Would mark ${n} of ${plural(prs.length, "open PR", "open PRs")} as spec PRs.`;
  preview.className = "rule-preview";
  document.getElementById("rule-suffixes").disabled = !rule.useRepoSuffix;
  document.getElementById("rule-keywords").disabled = !rule.useFileKeywords;
}

function renderSettings() {
  const rule = appState?.specRule;
  if (!rule) return;
  const theme = currentTheme();
  els.settings.innerHTML = html`<div class="drawer-head">
      <div class="drawer-top">
        <button type="button" class="drawer-close" id="settings-close-btn" aria-label="Close">${raw(icon("x"))}</button>
      </div>
      <h2 class="drawer-title">Settings</h2>
    </div>
    <div class="drawer-body">
      <section class="settings-section" aria-labelledby="appearance-title">
        <h3 class="settings-section-title" id="appearance-title">Appearance</h3>
        <p class="settings-intro">Colour theme for this browser. Applies immediately and is remembered here only.</p>
        <div class="segmented" role="radiogroup" aria-label="Colour theme" id="theme-picker">
          ${raw(THEMES.map((t) => html`<label class="segment${t.key === theme.key ? " is-on" : ""}">
            <input type="radio" name="theme" value="${t.key}" ${raw(t.key === theme.key ? "checked" : "")} />
            ${raw(icon(t.icon))}<span>${t.label}</span>
          </label>`).join(""))}
        </div>
        <div class="field-hint" id="theme-hint">${theme.hint}</div>
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
      <div class="btn-row">
        <button type="button" class="btn btn-primary" id="rule-save">Save</button>
        <button type="button" class="btn" id="rule-reset">Reset to defaults</button>
        <span class="field-hint" id="rule-hint"></span>
      </div>
      </section>
    </div>`;

  document.getElementById("settings-close-btn").addEventListener("click", closeSettings);
  document.getElementById("theme-picker").addEventListener("change", (e) => {
    const theme = setTheme(e.target.value);
    for (const seg of e.currentTarget.querySelectorAll(".segment")) seg.classList.toggle("is-on", seg.querySelector("input").value === theme.key);
    document.getElementById("theme-hint").textContent = theme.hint;
  });
  for (const id of ["rule-suffix-on", "rule-suffixes", "rule-files-on", "rule-keywords"]) {
    document.getElementById(id).addEventListener("input", updateSettingsPreview);
  }
  document.getElementById("rule-save").addEventListener("click", () => saveSpecRule(readSettingsForm()));
  document.getElementById("rule-reset").addEventListener("click", () => saveSpecRule(null));
  updateSettingsPreview();
}

async function saveSpecRule(rule) {
  const hint = document.getElementById("rule-hint");
  hint.textContent = "Saving…";
  const res = rule === null
    ? await fetch("/api/settings/spec-rule", { method: "DELETE" })
    : await fetch("/api/settings/spec-rule", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rule),
      });
  appState = await res.json();
  render({ skipDrawer: true });
  renderSettings();
  document.getElementById("rule-hint").textContent = rule === null ? "Defaults restored." : "Saved — sets regrouped.";
}

function openSettings() {
  if (drawerPrKey) closeDrawer();
  settingsOpen = true;
  lastFocused = document.activeElement;
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

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => render({ skipDrawer: drawerPrKey != null }), 150);
});

fetchState();
setInterval(() => fetchState({ skipDrawer: drawerPrKey != null }), POLL_MS);
