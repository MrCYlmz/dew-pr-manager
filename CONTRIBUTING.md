# Contributing

Thanks for taking a look. This is a small, deliberately constrained tool, so the bar for a
change is "does it keep the thing simple and correct", not "does it add a feature".

## Setup

```sh
bun install
bun run dev        # http://localhost:4317, rebuilds the client and restarts the server on change
bun test           # unit tests for src/domain/*.ts and the client rule modules
bun run typecheck  # src/ and tests/, then client/ with its own tsconfig (DOM lib, no Bun types)
bun run build      # bundles client/app.ts into public/app.js (bun start does this too)
```

You need an authenticated GitHub CLI (`gh auth status`) to run the app against real data. The
tests do not touch the network.

## What the code is allowed to do

A few rules are load-bearing and easy to break by accident:

- **Status is a closed, ordered vocabulary.** `DRAFT`, `CONFLICTED`, `CI_FAILING`,
  `CHANGES_REQUESTED`, `REVIEW_STALE`, `READY_TO_MERGE`, `STALE`, `NEEDS_REVIEW` — first match
  wins, in that order. Don't add or reorder without a good reason stated in the PR.
- **Owner is exactly one of `you`, `author`, `reviewers`**, derived from status plus authorship.
  It is never stored on its own.
- **Change sets group by exact head branch name only.** A manual link is the only override.
- **Read-only against GitHub.** No approvals, no merges, no comments, no writes of any kind.
- **No framework, no database, and one build step only.** `bun run build` bundles the client
  from `client/` into `public/app.js` with Bun's own bundler; nothing third-party goes into the
  bundle, and `public/app.js` is never edited or committed. Persisted state is plain JSON files a
  user can read and delete. Adding a dependency needs a reason.
- **Tunables live in `src/config.ts`**, not as magic numbers elsewhere.

## Sending a change

1. Keep the derivation logic in `src/domain/` pure and add a test for any rule you touch.
2. Run `bun run typecheck`, `bun run build` and `bun test`; CI runs the same three commands.
3. Describe *what behaviour changed* in the PR, not just what code changed.

Bug reports for the macOS and Windows notification paths are especially welcome — those were
written without a machine to verify on.
