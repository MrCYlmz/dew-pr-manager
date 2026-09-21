# Security

## What this tool touches

- **GitHub, read-only.** Every request goes through the GitHub CLI (`gh api graphql`,
  `gh auth token`) using whatever account `gh` is already logged in as. The app never stores a
  token of its own, never writes to GitHub, and never approves, merges or comments on anything.
- **Local files only.** State is plain JSON under `data/` in the working directory. Nothing is
  sent anywhere except GitHub's API and your OS's native notifier.
- **A local HTTP server** on `localhost:4317` (configurable) with no authentication. It binds to
  `127.0.0.1` only, refuses requests whose `Host` isn't a loopback name, and checks
  `Sec-Fetch-Site`/`Origin` on every write. It is meant for a single user on their own machine;
  don't expose the port to a network or open it in your firewall.
- **Static files come from `public/` only.** The request path is decoded and resolved before
  the file is opened, and anything that lands outside `public/` is answered with 404
  (`src/static.ts`).

## Runtime requirements

- **Bun 1.3.5 or newer.** Older releases are affected by CVE-2026-24910 (a package from a
  non-npm source could pass itself off as trusted and run install scripts). `package.json`
  declares the floor; check `bun --version` on every machine the tool runs on.
- **GitHub CLI.** Only `gh auth token` and `gh api graphql` are invoked, so the `gh attestation`
  / `gh release verify` and `gh auth status` advisories (CVE-2026-48501, CVE-2026-64652) don't
  apply — but keep `gh` current anyway.

## Reporting a vulnerability

Open a GitHub issue, or if it's something that shouldn't be public yet, use the
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
form on the repository's Security tab.
