import { collectOpenPullRequests } from "./github.ts";
import { applySpecRule, assignSetKeys, groupIntoChangeSets, normalizeSpecRule } from "./domain/changeSets.ts";
import { capHistory, diffScans } from "./domain/history.ts";
import { deriveOwner } from "./domain/owner.ts";
import { assignMentions } from "./domain/references.ts";
import { computeLastActivityAt, deriveStatus } from "./domain/status.ts";
import { notifyIfChanged } from "./notify.ts";
import {
  readHistory,
  readLinks,
  readNotes,
  readSnapshot,
  readNotifySetting,
  readSpecRuleSetting,
  writeHistory,
  writeSnapshot,
} from "./store.ts";
import type { AppState, DerivedPullRequest, PullRequestFacts, ScanMeta } from "./types.ts";

let scanning = false;
let cachedState: AppState | null = null;

function deriveFacts(facts: PullRequestFacts, viewerLogin: string): DerivedPullRequest {
  const status = deriveStatus(facts);
  return {
    ...facts,
    status,
    owner: deriveOwner(status, facts, viewerLogin),
    lastActivityAt: computeLastActivityAt(facts),
    isSpecPR: false,
    branchSetKey: facts.headRefName,
    setKey: facts.headRefName,
    manuallyLinked: false,
    mentions: [],
    mergeStep: null,
  };
}

async function buildState(derivedPrs: DerivedPullRequest[], meta: ScanMeta): Promise<AppState> {
  const [links, notes, history, ruleSetting, notify] = await Promise.all([
    readLinks(),
    readNotes(),
    readHistory(),
    readSpecRuleSetting(),
    readNotifySetting(),
  ]);
  const specRule = normalizeSpecRule(ruleSetting);
  const prs = assignMentions(assignSetKeys(applySpecRule(derivedPrs, specRule), links));
  const sets = groupIntoChangeSets(prs);
  return { meta, prs, sets, history, notes, links, specRule, notify };
}

async function buildEmptyState(): Promise<AppState> {
  return buildState([], {
    scannedAt: new Date().toISOString(),
    ranAs: cachedState?.meta.ranAs ?? "unknown",
    error: null,
    durationMs: 0,
  });
}

export function getCachedState(): AppState | null {
  return cachedState;
}

export function isScanning(): boolean {
  return scanning;
}

export async function regroup(): Promise<AppState | null> {
  const snapshot = await readSnapshot();
  if (!snapshot) return cachedState;
  cachedState = await buildState(snapshot.prs, snapshot.meta);
  return cachedState;
}

export async function runScan(): Promise<AppState> {
  if (scanning) {
    if (cachedState) return cachedState;
    return (await regroup()) ?? buildEmptyState();
  }

  scanning = true;
  const startedAt = Date.now();
  const previousSnapshot = await readSnapshot();
  const isFirstScan = previousSnapshot === null;

  try {
    const { viewerLogin, prs: facts } = await collectOpenPullRequests();
    const derived = facts.map((f) => deriveFacts(f, viewerLogin));
    const scannedAt = new Date().toISOString();
    const meta: ScanMeta = { scannedAt, ranAs: viewerLogin, error: null, durationMs: Date.now() - startedAt };

    const newEvents = diffScans(previousSnapshot?.prs ?? null, derived, scannedAt);
    const priorHistory = await readHistory();
    await writeHistory(capHistory([...priorHistory, ...newEvents]));

    const state = await buildState(derived, meta);

    await writeSnapshot({ prs: derived, meta });
    cachedState = state;

    await notifyIfChanged(newEvents, isFirstScan, state.notify);

    return state;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const meta: ScanMeta = {
      scannedAt: new Date().toISOString(),
      ranAs: previousSnapshot?.meta.ranAs ?? cachedState?.meta.ranAs ?? "unknown",
      error: message,
      durationMs: Date.now() - startedAt,
    };
    const state = await buildState(previousSnapshot?.prs ?? [], meta);
    cachedState = state;
    return state;
  } finally {
    scanning = false;
  }
}
