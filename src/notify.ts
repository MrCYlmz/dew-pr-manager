import { NOTIFY_ENABLED, PORT } from "./config.ts";
import type { HistoryEvent } from "./types.ts";

const DASHBOARD_URL = `http://localhost:${PORT}`;

function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * FR-8.26-27: batch to one call per scan; a transition into READY_TO_MERGE or CONFLICTED
 * outranks the rest.
 */
export function buildNotification(events: HistoryEvent[]): { title: string; body: string } | null {
  const changeCount = events.length;
  if (changeCount === 0) return null;

  const priority =
    events.find((e) => e.to === "READY_TO_MERGE") ??
    events.find((e) => e.to === "CONFLICTED") ??
    events[0]!;
  const headline = `${priority.prKey}: ${priority.from ?? "new"} → ${priority.to ?? "closed"}`;

  const title = changeCount === 1 ? "Pull Request Manager: 1 change" : `Pull Request Manager: ${changeCount} changes`;
  return { title, body: headline };
}

/**
 * FR-8.1: one native OS notification, never a bundled library. On Linux (notify-send with
 * -A) clicking "Open dashboard" genuinely opens the page via xdg-open, satisfying FR-8.27
 * for the platform this was built and tested on. macOS/Windows send a best-effort
 * notification without a working click-through — wiring that up would need a persistent
 * OS-level listener process, which is more machinery than "no framework, no bundled
 * notification library" calls for, and neither platform was available to verify against.
 */
async function sendDesktopNotification(title: string, body: string): Promise<void> {
  const platform = process.platform;
  try {
    if (platform === "linux") {
      const proc = Bun.spawn(["notify-send", "-A", "open=Open dashboard", title, body], {
        stdout: "pipe",
      });
      new Response(proc.stdout)
        .text()
        .then((out) => {
          if (out.trim() === "open") Bun.spawn(["xdg-open", DASHBOARD_URL]);
        })
        .catch(() => {});
    } else if (platform === "darwin") {
      const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`;
      Bun.spawn(["osascript", "-e", script]);
    } else if (platform === "win32") {
      const script = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$n = New-Object System.Windows.Forms.NotifyIcon",
        "$n.Icon = [System.Drawing.SystemIcons]::Information",
        "$n.Visible = $true",
        `$n.ShowBalloonTip(5000, ${psQuote(title)}, ${psQuote(body)}, [System.Windows.Forms.ToolTipIcon]::Info)`,
      ].join("; ");
      Bun.spawn(["powershell", "-NoProfile", "-Command", script]);
    }
  } catch {
    // Best-effort: a failed notification must never fail the scan.
  }
}

/** FR-8.28: suppressed on the server's first scan — there's no previous scan to diff against. */
export async function notifyIfChanged(events: HistoryEvent[], isFirstScan: boolean): Promise<void> {
  if (!NOTIFY_ENABLED || isFirstScan) return;
  const summary = buildNotification(events);
  if (summary) await sendDesktopNotification(summary.title, summary.body);
}
