import { NOTIFY_ENABLED, PORT } from "./config.ts";
import type { HistoryEvent } from "./types.ts";

const DASHBOARD_URL = `http://localhost:${PORT}`;

const BALLOON_MS = 5000;

const NOTIFY_LISTEN_MS = 2 * 60 * 1000;

let pending: { proc: { kill: () => void }; timer: ReturnType<typeof setTimeout> } | null = null;

function retirePendingNotification(): void {
  if (!pending) return;
  clearTimeout(pending.timer);
  try {
    pending.proc.kill();
  } catch {}
  pending = null;
}

function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

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

async function sendDesktopNotification(title: string, body: string): Promise<void> {
  const platform = process.platform;
  try {
    if (platform === "linux") {
      retirePendingNotification();

      const proc = Bun.spawn(["notify-send", "-A", "open=Open dashboard", title, body], {
        stdout: "pipe",
        stderr: "ignore",
      });

      const timer = setTimeout(() => {
        if (pending?.proc === proc) retirePendingNotification();
      }, NOTIFY_LISTEN_MS);
      timer.unref?.();
      pending = { proc, timer };

      new Response(proc.stdout)
        .text()
        .then((out) => {
          if (out.trim() === "open") Bun.spawn(["xdg-open", DASHBOARD_URL]);
        })
        .catch(() => {})
        .finally(() => {
          if (pending?.proc === proc) {
            clearTimeout(pending.timer);
            pending = null;
          }
        });
    } else if (platform === "darwin") {
      const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`;
      Bun.spawn(["osascript", "-e", script]);
    } else if (platform === "win32") {
      const script = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "Add-Type -AssemblyName System.Drawing",
        "$n = New-Object System.Windows.Forms.NotifyIcon",
        "$n.Icon = [System.Drawing.SystemIcons]::Information",
        "$n.Visible = $true",
        `$n.ShowBalloonTip(${BALLOON_MS}, ${psQuote(title)}, ${psQuote(body)}, [System.Windows.Forms.ToolTipIcon]::Info)`,
        `Start-Sleep -Milliseconds ${BALLOON_MS + 1000}`,
        "$n.Dispose()",
      ].join("; ");
      Bun.spawn(["powershell", "-NoProfile", "-NonInteractive", "-Command", script], {
        stdout: "ignore",
        stderr: "ignore",
      });
    }
  } catch {}
}

export async function notifyIfChanged(events: HistoryEvent[], isFirstScan: boolean): Promise<void> {
  if (!NOTIFY_ENABLED || isFirstScan) return;
  const summary = buildNotification(events);
  if (summary) await sendDesktopNotification(summary.title, summary.body);
}
