import { NOTIFY_ENABLED, PORT } from "./config.ts";
import type { HistoryEvent } from "./types.ts";

const DASHBOARD_URL = `http://localhost:${PORT}`;

/** How long the Windows balloon asks to stay up. The script sleeps past it — see below. */
const BALLOON_MS = 5000;

/**
 * How long a Linux `notify-send -A` listener is allowed to sit waiting for a click before it
 * is retired. Generous enough that the notification has been seen and acted on if it was going
 * to be, short enough that nothing accumulates across a day of scans.
 */
const NOTIFY_LISTEN_MS = 2 * 60 * 1000;

/** The one in-flight `notify-send -A` listener, if any. See the Linux branch below. */
let pending: { proc: { kill: () => void }; timer: ReturnType<typeof setTimeout> } | null = null;

function retirePendingNotification(): void {
  if (!pending) return;
  clearTimeout(pending.timer);
  try {
    pending.proc.kill();
  } catch {
    // Already gone — nothing to do.
  }
  pending = null;
}

/**
 * Wraps a value as a PowerShell single-quoted string. Inside single quotes PowerShell treats
 * `$`, backticks and quotes as literal, so doubling the single quote is the whole escape —
 * a PR title carrying `'` or `$(...)` cannot break out of the string or inject a command.
 */
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
 * FR-8.1: one native OS notification per scan, never a bundled library — a single shell call
 * to whatever the platform already ships.
 *
 * Support is uneven, and FR-8.27's click-through is best-effort everywhere. The honest state
 * of each platform:
 *
 * - **Linux** (`notify-send`): the notification itself is reliable and is the only path that
 *   has actually been exercised. The `-A` action button is not reliable: under a Portal /
 *   confined notification backend libnotify drops actions altogether ("Running in confined
 *   mode, using Portal notifications"), so "Open dashboard" simply will not appear for some
 *   users. `-A` also makes `notify-send` block until the notification is acted on; the
 *   listener is bounded below so an unattended dashboard cannot accumulate processes.
 * - **macOS** (`osascript`): displays, no click-through. UNVERIFIED — no machine to test on.
 * - **Windows** (PowerShell `NotifyIcon`): displays only because the script outlives the
 *   balloon. The tray icon owns the balloon, so letting PowerShell exit straight after
 *   `ShowBalloonTip` destroys the notification before it is drawn — hence the sleep, which
 *   must outlast the balloon's own timeout. Balloon tips are legacy: Windows 10/11 reroute
 *   them into the toast system, where Focus Assist and per-app notification settings can
 *   suppress them for a transient tray icon that has no registered app identity. No
 *   click-through. UNVERIFIED — written without a Windows machine to run it on.
 *
 * Wiring up real click-through on macOS/Windows needs a persistent OS-level listener process
 * (or a registered AppUserModelID for a proper WinRT toast), which is more machinery than
 * "no framework, no bundled notification library" calls for.
 */
async function sendDesktopNotification(title: string, body: string): Promise<void> {
  const platform = process.platform;
  try {
    if (platform === "linux") {
      // `notify-send -A` blocks until the notification is clicked or dismissed, so an
      // unattended dashboard would otherwise accumulate one resident process per scan
      // forever. Two bounds keep that at a maximum of one: a new scan retires the previous
      // scan's listener (its notification is superseded anyway), and any listener nobody
      // touches is retired after NOTIFY_LISTEN_MS.
      retirePendingNotification();

      const proc = Bun.spawn(["notify-send", "-A", "open=Open dashboard", title, body], {
        stdout: "pipe",
        stderr: "ignore",
      });

      const timer = setTimeout(() => {
        if (pending?.proc === proc) retirePendingNotification();
      }, NOTIFY_LISTEN_MS);
      // Never let a pending notification hold the process open at shutdown.
      timer.unref?.();
      pending = { proc, timer };

      new Response(proc.stdout)
        .text()
        .then((out) => {
          if (out.trim() === "open") Bun.spawn(["xdg-open", DASHBOARD_URL]);
        })
        .catch(() => {})
        .finally(() => {
          // It exited on its own (clicked or dismissed) — drop the timer, nothing to kill.
          if (pending?.proc === proc) {
            clearTimeout(pending.timer);
            pending = null;
          }
        });
    } else if (platform === "darwin") {
      const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`;
      Bun.spawn(["osascript", "-e", script]);
    } else if (platform === "win32") {
      // ShowBalloonTip is asynchronous and the balloon belongs to the tray icon, so the script
      // has to stay alive past BALLOON_MS or the notification dies before it is shown. Both
      // assemblies are loaded explicitly: System.Drawing is only a transitive dependency of
      // System.Windows.Forms under Windows PowerShell 5.1, and relying on that is luck.
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
