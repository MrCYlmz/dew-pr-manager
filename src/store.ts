import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./config.ts";
import type { DerivedPullRequest, HistoryEvent, ManualLink, Note, ScanMeta, SpecRule } from "./types.ts";

const dataDir = join(process.cwd(), DATA_DIR);
const linksPath = join(dataDir, "links.json");
const notesPath = join(dataDir, "notes.json");
const historyPath = join(dataDir, "history.json");
const snapshotPath = join(dataDir, "snapshot.json");
const settingsPath = join(dataDir, "settings.json");

async function ensureDataDir(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  const file = Bun.file(path);
  if (!(await file.exists())) return fallback;
  return (await file.json()) as T;
}

/** Write to a temp file then rename over the target, so a crash mid-write can't corrupt it. */
async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await ensureDataDir();
  const tmpPath = `${path}.tmp`;
  await Bun.write(tmpPath, JSON.stringify(value, null, 2));
  await rename(tmpPath, path);
}

// --- Manual links (FR-6.19-20): PR key -> target change-set key. ---

export async function readLinks(): Promise<Record<string, string>> {
  return readJson<Record<string, string>>(linksPath, {});
}

export async function setLink(prKey: string, targetSetKey: string): Promise<Record<string, string>> {
  const links = await readLinks();
  links[prKey] = targetSetKey;
  await writeJsonAtomic(linksPath, links);
  return links;
}

export async function removeLink(prKey: string): Promise<Record<string, string>> {
  const links = await readLinks();
  delete links[prKey];
  await writeJsonAtomic(linksPath, links);
  return links;
}

// --- Notes (FR-6.22): free-text note per PR, keyed by PR. Clearing the text deletes it. ---

export async function readNotes(): Promise<Record<string, Note>> {
  return readJson<Record<string, Note>>(notesPath, {});
}

export async function setNote(prKey: string, text: string): Promise<Record<string, Note>> {
  const notes = await readNotes();
  if (text.trim() === "") {
    delete notes[prKey];
  } else {
    notes[prKey] = { prKey, text, savedAt: new Date().toISOString() } satisfies Note;
  }
  await writeJsonAtomic(notesPath, notes);
  return notes;
}

// --- Settings (FR-4.15): the one dashboard-editable tunable, the spec-PR rule. Absent file or
// key means "use the defaults from config.ts"; the caller normalizes whatever is here.

interface Settings {
  specRule?: unknown;
}

export async function readSpecRuleSetting(): Promise<unknown> {
  return (await readJson<Settings>(settingsPath, {})).specRule;
}

/** `null` removes the override so the defaults apply again. */
export async function writeSpecRuleSetting(rule: SpecRule | null): Promise<void> {
  const settings = await readJson<Settings>(settingsPath, {});
  if (rule === null) delete settings.specRule;
  else settings.specRule = rule;
  await writeJsonAtomic(settingsPath, settings);
}

// --- Status history (FR-7.24): capped list of transition events, already capped by the caller. ---

export async function readHistory(): Promise<HistoryEvent[]> {
  return readJson<HistoryEvent[]>(historyPath, []);
}

export async function writeHistory(events: HistoryEvent[]): Promise<void> {
  await writeJsonAtomic(historyPath, events);
}

// --- Last-good snapshot: rebuilt every scan, but persisted so a restart or a failed scan
// still has something to serve (Platform and constraints: "stale data with a warning beats
// a blank page").

export interface Snapshot {
  prs: DerivedPullRequest[];
  meta: ScanMeta;
}

export async function readSnapshot(): Promise<Snapshot | null> {
  return readJson<Snapshot | null>(snapshotPath, null);
}

export async function writeSnapshot(snapshot: Snapshot): Promise<void> {
  await writeJsonAtomic(snapshotPath, snapshot);
}

export type { ManualLink };
