// Vanilla JS, no framework, no build step — the whole client in one file (Platform: "Size").

const POLL_MS = 20000;
const LAST_VISIT_KEY = "prManagerLastVisit";

// FR-7.25: "since the user's previous visit, or the last 24 hours on a first visit" — and
// "an already-open tab accumulates changes rather than resetting on every auto-refresh"
// means this cutoff is captured ONCE per page load, not recomputed on every poll.
const sessionCutoff = localStorage.getItem(LAST_VISIT_KEY);
localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());

const STATUS_META = {
  DRAFT: { label: "Draft", color: "var(--status-draft)" },
  CONFLICTED: { label: "Conflicted", color: "var(--status-conflicted)" },
  CI_FAILING: { label: "CI failing", color: "var(--status-ci_failing)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "var(--status-changes_requested)" },
  REVIEW_STALE: { label: "Review stale", color: "var(--status-review_stale)" },
  READY_TO_MERGE: { label: "Ready to merge", color: "var(--status-ready_to_merge)" },
  STALE: { label: "Stale", color: "var(--status-stale)" },
  NEEDS_REVIEW: { label: "Needs review", color: "var(--status-needs_review)" },
};

// --- tiny safe-HTML templating: escapes every interpolated value unless wrapped in raw(). ---

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

function statusMeta(status) {
  return STATUS_META[status] ?? { label: status, color: "var(--text-muted)" };
}

// --- state ---

let appState = null;
let currentView = new URLSearchParams(location.search).get("view") || "overview";
let drawerPrKey = null;
let linkSelectValue = null;

const els = {
  scanMeta: document.getElementById("scan-meta"),
  tiles: document.getElementById("stat-tiles"),
  alerts: document.getElementById("alerts-section"),
  changes: document.getElementById("changes-section"),
  connections: document.getElementById("connections-section"),
  buckets: document.getElementById("buckets-section"),
  drawer: document.getElementById("drawer"),
  scrim: document.getElementById("drawer-scrim"),
  refreshBtn: document.getElementById("refresh-btn"),
  tabs: document.getElementById("tabs"),
};

async function fetchState() {
  const res = await fetch("/api/state");
  appState = await res.json();
  render();
}

async function refresh() {
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = "Refreshing…";
  try {
    const res = await fetch("/api/refresh", { method: "POST" });
    appState = await res.json();
    render();
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = "Refresh";
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

// --- view scoping: FR "a change set is never split by a filter" ---

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

// --- render orchestration ---

function render() {
  renderHeader();
  renderTabs();
  if (!appState) return;
  const sets = visibleSets();
  const visibleKeys = new Set(sets.flatMap((s) => s.members.map((m) => m.key)));
  renderStatTiles(sets);
  renderAlerts(visibleKeys);
  renderChanges(visibleKeys);
  renderConnections(sets);
  renderBuckets(sets);
  renderDrawer();
}

function renderHeader() {
  if (!appState || !appState.meta) {
    els.scanMeta.textContent = "Scanning for the first time…";
    return;
  }
  const { scannedAt, ranAs, error } = appState.meta;
  const scanningNote = appState.scanning ? " · scanning now…" : "";
  els.scanMeta.innerHTML = html`Last scan ${timeAgo(scannedAt)} as <strong>${ranAs}</strong>${raw(escapeHtml(scanningNote))}${raw(
    error ? `<div class="error">Last scan failed: ${escapeHtml(error)} — showing the last good data.</div>` : "",
  )}`;
}

function renderTabs() {
  for (const btn of els.tabs.querySelectorAll("[data-view]")) {
    btn.classList.toggle("active", btn.dataset.view === currentView);
  }
  document.getElementById("count-overview").textContent = appState ? `(${countForView("overview")})` : "";
  document.getElementById("count-mine").textContent = appState ? `(${countForView("mine")})` : "";
  document.getElementById("count-review").textContent = appState ? `(${countForView("review")})` : "";
}

// --- stat tiles ---

function renderStatTiles(sets) {
  const uniquePrs = new Set(sets.flatMap((s) => s.members.map((m) => m.key))).size;
  const tiles = [
    { label: "Change sets waiting on you", value: sets.filter((s) => s.owner === "you").length, hero: true },
    { label: "Open PRs", value: uniquePrs },
    { label: "Change sets", value: sets.length },
    { label: "Ready to merge", value: sets.filter((s) => s.status === "READY_TO_MERGE").length },
    { label: "Rotting", value: sets.filter((s) => s.status === "STALE").length },
    { label: "Contract alerts", value: appState.alerts.filter((a) => sets.some((s) => s.members.some((m) => m.key === a.prKey))).length },
  ];
  els.tiles.innerHTML = tiles
    .map((t) => html`<div class="tile ${raw(t.hero ? "hero" : "")}"><div class="value">${t.value}</div><div class="label">${t.label}</div></div>`)
    .join("");
}

// --- contract alerts: hidden entirely when none (FR: "one line each") ---

function renderAlerts(visibleKeys) {
  const alerts = appState.alerts.filter((a) => visibleKeys.has(a.prKey));
  if (alerts.length === 0) {
    els.alerts.innerHTML = "";
    return;
  }
  els.alerts.innerHTML = html`<h2 class="section-title">Contract alerts</h2>${raw(
    alerts.map((a) => html`<div class="alert-row"><a href="${a.prUrl}" target="_blank" rel="noopener">${a.prKey}</a> — ${a.message}</div>`).join(""),
  )}`;
}

// --- changes since last visit (FR-7.25) ---

function renderChanges(visibleKeys) {
  const cutoff = sessionCutoff ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const events = appState.history
    .filter((e) => e.at >= cutoff && visibleKeys.has(e.prKey))
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  if (events.length === 0) {
    els.changes.innerHTML = "";
    return;
  }
  els.changes.innerHTML = html`<h2 class="section-title">Changes</h2>${raw(
    events
      .map(
        (e) => html`<div class="change-row" data-pr-key="${e.prKey}">
          <a href="${e.prUrl}" target="_blank" rel="noopener">${e.prKey}</a>
          <span class="change-arrow">→</span>${raw(e.from ? statusMeta(e.from).label : "new")}
          <span class="change-arrow">→</span>${raw(e.to ? statusMeta(e.to).label : "closed")}
        </div>`,
      )
      .join(""),
  )}`;
}

// --- connections diagrams: spec PRs top row, consumers below, single bus (FR "Connections") ---

function prNodeSvg(pr, x, y) {
  const meta = statusMeta(pr.status);
  const dashed = pr.manuallyLinked ? "stroke-dasharray=\"4,3\"" : "";
  return `
    <g class="pr-node" data-pr-key="${escapeHtml(pr.key)}" transform="translate(${x},${y})">
      <rect width="150" height="46" rx="6" stroke="${meta.color}" ${dashed} />
      <text x="8" y="16">${escapeHtml(pr.repo)}#${pr.number}</text>
      <text x="8" y="30" class="meta">${escapeHtml(meta.label)} · ${timeAgo(pr.createdAt)}</text>
      <text x="8" y="41" class="meta">+${pr.additions}/-${pr.deletions}</text>
    </g>`;
}

function renderConnections(sets) {
  const multi = sets.filter((s) => s.members.length > 1);
  const solo = sets.filter((s) => s.members.length === 1).length;

  if (multi.length === 0) {
    els.connections.innerHTML = solo > 0 ? html`<div class="solo-count">${solo} PR${raw(solo === 1 ? "" : "s")} connected to nothing.</div>` : "";
    return;
  }

  const diagrams = multi
    .map((set) => {
      const specs = set.members.filter((m) => m.isSpecPR);
      const consumers = set.members.filter((m) => !m.isSpecPR);
      const width = Math.max(specs.length, consumers.length, 1) * 170 + 20;
      const busY = 70;
      const nodes = [
        ...specs.map((m, i) => prNodeSvg(m, 10 + i * 170, 10)),
        ...consumers.map((m, i) => prNodeSvg(m, 10 + i * 170, 100)),
      ].join("");
      const stems = [
        ...specs.map((_, i) => `<line x1="${85 + i * 170}" y1="56" x2="${85 + i * 170}" y2="${busY}" stroke="var(--border)" />`),
        ...consumers.map((_, i) => `<line x1="${85 + i * 170}" y1="${busY}" x2="${85 + i * 170}" y2="100" stroke="var(--border)" />`),
      ].join("");
      const bus = specs.length && consumers.length ? `<line x1="10" y1="${busY}" x2="${width - 10}" y2="${busY}" stroke="var(--border)" stroke-width="2" />` : "";
      const orderNote = set.mergeOrderKnown ? "" : ` <span class="meta">(merge order unknown — no spec PR found)</span>`;
      return html`<div class="set-diagram">
        <div class="set-diagram-title">${set.label}${raw(orderNote)}</div>
        <svg width="${width}" height="150" viewBox="0 0 ${width} 150">${raw(bus + stems + nodes)}</svg>
      </div>`;
    })
    .join("");

  els.connections.innerHTML = html`<h2 class="section-title">Connections</h2>${raw(diagrams)}${raw(
    solo > 0 ? `<div class="solo-count">${solo} PR${solo === 1 ? "" : "s"} connected to nothing.</div>` : "",
  )}`;
}

els.connections.addEventListener("click", (e) => {
  const node = e.target.closest("[data-pr-key]");
  if (node) openDrawer(node.dataset.prKey);
});

// --- overview buckets ---
// FR names exactly six buckets. A set whose owner is 'author' (blocked on someone other than
// the viewer or "reviewers" generically — e.g. a PR you're reviewing that currently has merge
// conflicts) has no home among those six; it stays reachable via the tabs/connections/drawer
// instead of being force-fit into a bucket the spec didn't name.
const BUCKETS = [
  { key: "bot", title: "Bot PRs", desc: "Automated PRs. Out of the way, but not hidden.", match: (s) => s.members.every((m) => m.authorIsBot) },
  { key: "ready", title: "Ready to merge", desc: "Approved, mergeable, checks green. Go merge it.", match: (s) => s.status === "READY_TO_MERGE" },
  { key: "draft", title: "Drafts", desc: "Not ready for review yet.", match: (s) => s.status === "DRAFT" },
  { key: "rotting", title: "Rotting", desc: "No activity in over a week. Close it, revive it, or leave a note.", match: (s) => s.status === "STALE" },
  { key: "you", title: "Waiting on you", desc: "The next move is yours.", match: (s) => s.owner === "you" },
  { key: "reviewers", title: "Waiting on reviewers", desc: "Sitting with someone else for now.", match: (s) => s.owner === "reviewers" },
];

function bucketFor(set) {
  return BUCKETS.find((b) => b.match(set)) ?? null;
}

function memberRow(pr, indented) {
  const meta = statusMeta(pr.status);
  const note = appState.notes[pr.key];
  return html`<div class="pr-row ${raw(indented ? "indented" : "")}" data-pr-key="${pr.key}">
    <span class="status-dot" style="background:${raw(meta.color)}"></span>
    <span class="pr-repo">${pr.repo}#${pr.number}</span>
    <span class="pr-title">${pr.title}</span>
    ${raw(pr.manuallyLinked ? `<span class="linked-flag">linked</span>` : "")}
    ${raw(note ? `<span class="pr-note-flag" title="${escapeHtml(note.text)}">note</span>` : "")}
    <span class="pr-size">+${pr.additions}/-${pr.deletions}</span>
    <span class="status-label" style="color:${raw(meta.color)}">${meta.label}</span>
  </div>`;
}

function setRows(set) {
  if (set.members.length === 1) return memberRow(set.members[0], false);
  const meta = statusMeta(set.status);
  return html`<div class="set-header">
      <span class="status-dot" style="background:${raw(meta.color)}"></span>
      ${set.label} <span class="status-label" style="color:${raw(meta.color)}">${meta.label}</span>
      ${raw(!set.mergeOrderKnown ? `<span class="meta"> · merge order unknown</span>` : "")}
    </div>${raw(set.members.map((m) => memberRow(m, true)).join(""))}`;
}

function renderBuckets(sets) {
  const grouped = new Map(BUCKETS.map((b) => [b.key, []]));
  for (const set of sets) {
    const bucket = bucketFor(set);
    if (bucket) grouped.get(bucket.key).push(set);
  }
  const sections = BUCKETS.filter((b) => grouped.get(b.key).length > 0)
    .map(
      (b) => html`<div class="bucket">
        <h3 class="bucket-title">${b.title}</h3>
        <p class="bucket-desc">${b.desc}</p>
        ${raw(grouped.get(b.key).map(setRows).join(""))}
      </div>`,
    )
    .join("");
  els.buckets.innerHTML = sections || `<p class="empty-note">Nothing open in this view.</p>`;
}

els.buckets.addEventListener("click", (e) => {
  const row = e.target.closest("[data-pr-key]");
  if (row) openDrawer(row.dataset.prKey);
});
els.changes.addEventListener("click", (e) => {
  // links inside change rows open GitHub directly; nothing else to wire here.
});

// --- detail drawer ---

function findPr(prKey) {
  return appState?.prs.find((p) => p.key === prKey) ?? null;
}

function openDrawer(prKey) {
  drawerPrKey = prKey;
  renderDrawer();
}

function closeDrawer() {
  drawerPrKey = null;
  els.drawer.classList.add("hidden");
  els.scrim.classList.add("hidden");
}

els.scrim.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

let noteSaveTimer = null;
function scheduleNoteSave(prKey, text) {
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(async () => {
    const res = await fetch(`/api/notes/${encodeURIComponent(prKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    appState = await res.json();
    // Re-render everything except the drawer's own input, so the textarea keeps focus/cursor.
    renderHeader();
    renderTabs();
    const sets = visibleSets();
    const visibleKeys = new Set(sets.flatMap((s) => s.members.map((m) => m.key)));
    renderStatTiles(sets);
    renderAlerts(visibleKeys);
    renderChanges(visibleKeys);
    renderConnections(sets);
    renderBuckets(sets);
  }, 800);
}

async function handleLinkChange(prKey, value, branchSetKey) {
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

function renderDrawer() {
  if (!drawerPrKey) return;
  const pr = findPr(drawerPrKey);
  if (!pr) return; // FR: a background refresh must never close/re-render the drawer under the cursor.

  els.scrim.classList.remove("hidden");
  els.drawer.classList.remove("hidden");

  const meta = statusMeta(pr.status);
  const note = appState.notes[pr.key];
  const set = appState.sets.find((s) => s.members.some((m) => m.key === pr.key));

  const linkOptions = appState.sets
    .filter((s) => s.key !== pr.branchSetKey)
    .map((s) => html`<option value="${s.key}" ${raw(pr.setKey === s.key ? "selected" : "")}>${s.label} (${s.key})</option>`)
    .join("");

  const checksHtml = pr.checks.length
    ? pr.checks.map((c) => html`<div class="check-row"><span>${c.name}</span><span>${c.state}</span></div>`).join("")
    : `<p class="empty-note">No CI checks.</p>`;

  const reviewsHtml = pr.reviews.length
    ? pr.reviews.map((r) => html`<div class="review-row"><span>${r.author}</span><span>${r.state}</span></div>`).join("")
    : `<p class="empty-note">No reviews yet.</p>`;

  const membersHtml = set
    ? set.members
        .map(
          (m) => html`<div class="member-row" data-pr-key="${m.key}">${raw(m.key === pr.key ? "<strong>" : "")}${m.repo}#${m.number} — ${statusMeta(m.status).label}${raw(m.key === pr.key ? "</strong>" : "")}</div>`,
        )
        .join("")
    : "";

  els.drawer.innerHTML = html`
    <button class="drawer-close" id="drawer-close-btn" aria-label="Close">✕</button>
    <span class="status-dot" style="background:${raw(meta.color)}"></span>
    <span class="status-label" style="color:${raw(meta.color)}">${meta.label}</span>
    <h2>${pr.title}</h2>
    <a href="${pr.url}" target="_blank" rel="noopener">${pr.repo}#${pr.number} on GitHub ↗</a>

    <div class="drawer-section-title">Change set link</div>
    <select id="link-select">
      <option value="__branch__" ${raw(!pr.manuallyLinked ? "selected" : "")}>Use branch grouping (${pr.branchSetKey})</option>
      ${raw(linkOptions)}
    </select>

    <div class="drawer-section-title">Note</div>
    <textarea id="note-input" placeholder="Why is this stuck? What was agreed?">${raw(escapeHtml(note?.text ?? ""))}</textarea>

    <dl>
      <dt>Owner</dt><dd>${pr.owner}</dd>
      <dt>Author</dt><dd>${pr.author}${raw(pr.authorIsBot ? " (bot)" : "")}</dd>
      <dt>Branch</dt><dd>${pr.headRefName} → ${pr.baseRefName}</dd>
      <dt>Size</dt><dd>+${pr.additions}/-${pr.deletions}, ${pr.changedFiles} files</dd>
      <dt>Opened</dt><dd>${timeAgo(pr.createdAt)}</dd>
      <dt>Last activity</dt><dd>${timeAgo(pr.lastActivityAt)}</dd>
      <dt>Mergeable</dt><dd>${pr.mergeableState}</dd>
      <dt>Breaking?</dt><dd>${pr.breakingDeclaration}</dd>
    </dl>

    <div class="drawer-section-title">CI checks</div>
    ${raw(checksHtml)}

    <div class="drawer-section-title">Reviews</div>
    ${raw(reviewsHtml)}

    ${raw(set && set.members.length > 1 ? `<div class="drawer-section-title">Change set — ${escapeHtml(set.label)} (merge order)</div>${membersHtml}` : "")}
  `;

  document.getElementById("drawer-close-btn").addEventListener("click", closeDrawer);
  document.getElementById("note-input").addEventListener("input", (e) => scheduleNoteSave(pr.key, e.target.value));
  document.getElementById("link-select").addEventListener("change", (e) => handleLinkChange(pr.key, e.target.value, pr.branchSetKey));
  els.drawer.querySelectorAll(".member-row[data-pr-key]").forEach((row) => {
    row.addEventListener("click", () => openDrawer(row.dataset.prKey));
  });
}

// --- boot ---

fetchState();
setInterval(fetchState, POLL_MS);
