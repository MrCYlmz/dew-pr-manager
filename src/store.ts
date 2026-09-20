import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, DEFAULT_NOTIFY } from "./config.ts";
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

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await ensureDataDir();
  const tmpPath = `${path}.tmp`;
  await Bun.write(tmpPath, JSON.stringify(value, null, 2));
  await rename(tmpPath, path);
}

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

interface Settings {
  specRule?: unknown;
  notify?: unknown;
}

export async function readSpecRuleSetting(): Promise<unknown> {
  return (await readJson<Settings>(settingsPath, {})).specRule;
}

export async function writeSpecRuleSetting(rule: SpecRule | null): Promise<void> {
  const settings = await readJson<Settings>(settingsPath, {});
  if (rule === null) delete settings.specRule;
  else settings.specRule = rule;
  await writeJsonAtomic(settingsPath, settings);
}

export async function readNotifySetting(): Promise<boolean> {
  const value = (await readJson<Settings>(settingsPath, {})).notify;
  return typeof value === "boolean" ? value : DEFAULT_NOTIFY;
}

export async function writeNotifySetting(enabled: boolean): Promise<void> {
  const settings = await readJson<Settings>(settingsPath, {});
  settings.notify = enabled;
  await writeJsonAtomic(settingsPath, settings);
}

export async function readHistory(): Promise<HistoryEvent[]> {
  return readJson<HistoryEvent[]>(historyPath, []);
}

export async function writeHistory(events: HistoryEvent[]): Promise<void> {
  await writeJsonAtomic(historyPath, events);
}

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
