# Security

## What this tool touches

- **GitHub, read-only.** Every request goes through the GitHub CLI (`gh api graphql`,
  `gh auth token`) using whatever account `gh` is already logged in as. The app never stores a
  token of its own, never writes to GitHub, and never approves, merges or comments on anything.
- **Local files only.** State is plain JSON under `data/` in the working directory. Nothing is
  sent anywhere except GitHub's API and your OS's native notifier.
- **A local HTTP server** on `localhost:4317` (configurable) with no authentication. It is meant
  for a single user on their own machine; don't expose the port to a network.

## Reporting a vulnerability

Open a GitHub issue, or if it's something that shouldn't be public yet, use the
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
form on the repository's Security tab.
