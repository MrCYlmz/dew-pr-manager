# Pull Request Manager

A personal, locally-run dashboard that answers one question each morning: which of your open
pull requests need you, and which are stuck on someone else. Read-only — it reports state, it
never reviews code and never merges anything.

## Run it

Requires [Bun](https://bun.sh) and an already-authenticated [GitHub CLI](https://cli.github.com)
(`gh auth status` should show a logged-in account). Nothing else to configure.

```sh
bun install
bun run dev     # auto-restarts on change
# or: bun start
```

Open `http://localhost:4317`. The page loads immediately and says so while the first scan runs;
it rescans automatically every five minutes, plus a manual refresh button.

## Environment variables

Exactly three, all optional:

| Variable | Default | Effect |
| --- | --- | --- |
| `PR_MANAGER_ACCOUNT` | active `gh` account | Which logged-in GitHub CLI account to scan as, when more than one is signed in. Resolves that account's token via `gh auth token -u <login>` rather than switching the machine's active `gh` account. |
| `PR_MANAGER_PORT` | `4317` | Which port to serve the dashboard on. |
| `PR_MANAGER_NOTIFY` | `on` | Set to `off` to disable the batched desktop notification on change. See [Desktop notifications](#desktop-notifications) for what actually works on which platform. |

## Desktop notifications

One native OS notification per scan, only when something actually changed, and never one per PR.
It is a single shell call to whatever the platform already ships — there is no bundled
notification library. Set `PR_MANAGER_NOTIFY=off` to turn it off entirely.

Platform support is uneven, and only Linux has been verified:

| Platform | Mechanism | State |
| --- | --- | --- |
| Linux | `notify-send` | **Tested.** The notification is reliable. The "Open dashboard" button is not: under a Portal/confined notification backend (common on GNOME) libnotify drops actions, so the button may never appear. |
| macOS | `osascript` | **Untested** — no machine to verify against. Expected to display; no click-through. |
| Windows | PowerShell `NotifyIcon` balloon | **Untested** — written without a Windows machine to run it on. It may not appear at all: balloon tips are legacy and Windows 10/11 reroute them through the toast system, where Focus Assist and per-app notification settings can suppress them for a tray icon with no registered app identity. No click-through. |

If you run this on Windows or macOS and the popup does or doesn't show up, that is worth knowing —
the Windows path in particular is a best-effort guess, not a verified feature.

## Tunables

Everything that is an organisation convention rather than an end-user preference — the
7-day staleness threshold, the 5-minute scan interval, the 500-event history cap, and the spec-PR
detection rule (`-openapi` repo suffix / `openapi`|`swagger` in a changed filename) — lives in one
place: `src/config.ts`.

## Data

State lives as plain JSON under `data/` (git-ignored, safe to delete): `links.json` (manual
change-set links), `notes.json` (your per-PR notes), `history.json` (the capped status-transition
log), and `snapshot.json` (the last successfully derived scan, so a restart or a failed scan
still has something to show). Nothing about a PR itself is stored here — GitHub is the only
source of truth for PR facts; this directory only holds the three things you added yourself
(links, notes) plus a cache.

## Tests

```sh
bun test        # unit tests for the derivation logic (status, owner, grouping, history)
bun run typecheck
```

The derivation logic (`src/domain/*.ts`) is unit tested. The GitHub client (`src/github.ts`) and
the server/UI are verified by running the app against a real, authenticated `gh` account — there
isn't a mocked GitHub API in here to test against instead.
