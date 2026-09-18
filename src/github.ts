import { ACCOUNT, FETCH_CONCURRENCY } from "./config.ts";
import type { CheckItem, PullRequestFacts, Review } from "./types.ts";

type Env = Record<string, string>;

interface PRRef {
  owner: string;
  repo: string;
  number: number;
}

export interface CollectResult {
  viewerLogin: string;
  prs: PullRequestFacts[];
}

/** Runs `gh <args>` as a subprocess (argv array, never a shell string — no injection risk). */
async function runGh(args: string[], env: Env): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe", env });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`gh ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`);
  }
  return stdout;
}

async function ghGraphql<T>(
  env: Env,
  query: string,
  variables: Record<string, string | number>,
): Promise<T> {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    args.push(typeof value === "number" ? "-F" : "-f", `${key}=${value}`);
  }
  const out = await runGh(args, env);
  const parsed = JSON.parse(out) as { data?: T; errors?: unknown };
  if (parsed.errors) {
    throw new Error(`GitHub GraphQL error: ${JSON.stringify(parsed.errors)}`);
  }
  return parsed.data as T;
}

/**
 * FR-1.2 (partly) + "three optional environment settings": with PR_MANAGER_ACCOUNT set,
 * resolve that account's token via `gh auth token -u <login>` and use it for every call
 * below, instead of mutating the machine's globally-active `gh` account.
 */
async function resolveEnv(): Promise<Env> {
  const base = process.env as Env;
  if (!ACCOUNT) return base;
  const token = (await runGh(["auth", "token", "-u", ACCOUNT], base)).trim();
  return { ...base, GH_TOKEN: token };
}

/** FR-1.2: identify the user from the credential in use, never a configured name. */
async function resolveViewerLogin(env: Env): Promise<string> {
  return (await runGh(["api", "user", "--jq", ".login"], env)).trim();
}

const SEARCH_QUERY = `
query($search: String!, $cursor: String) {
  search(query: $search, type: ISSUE, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        repository { name owner { login } }
      }
    }
  }
}`;

interface SearchResponse {
  search: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: { number: number; repository: { name: string; owner: { login: string } } }[];
  };
}

/** FR-1.1: one open, non-archived, viewer-scoped PR search (author or review-requested). */
async function searchOpenPRs(env: Env, qualifier: string): Promise<PRRef[]> {
  const refs: PRRef[] = [];
  let cursor: string | undefined;
  for (;;) {
    const variables: Record<string, string> = { search: qualifier };
    if (cursor) variables.cursor = cursor;
    const data = await ghGraphql<SearchResponse>(env, SEARCH_QUERY, variables);
    for (const node of data.search.nodes) {
      refs.push({ owner: node.repository.owner.login, repo: node.repository.name, number: node.number });
    }
    if (!data.search.pageInfo.hasNextPage) break;
    cursor = data.search.pageInfo.endCursor ?? undefined;
  }
  return refs;
}

const DETAIL_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      title
      url
      bodyText
      isDraft
      mergeable
      reviewDecision
      headRefName
      baseRefName
      additions
      deletions
      changedFiles
      createdAt
      author { login __typename }
      reviewRequests(first: 30) {
        nodes { requestedReviewer { __typename ... on User { login } } }
      }
      reviews(first: 50) {
        nodes { author { login } state submittedAt commit { oid } }
      }
      comments(last: 1) { nodes { createdAt } }
      files(first: 100) { nodes { path } }
      commits(last: 1) {
        nodes {
          commit {
            oid
            committedDate
            statusCheckRollup {
              state
              contexts(first: 50) {
                nodes {
                  __typename
                  ... on CheckRun { name conclusion status }
                  ... on StatusContext { context state }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

// Minimal typing for the pieces of the GraphQL response this module actually reads.
interface DetailResponse {
  repository: {
    pullRequest: {
      number: number;
      title: string;
      url: string;
      bodyText: string | null;
      isDraft: boolean;
      mergeable: PullRequestFacts["mergeableState"];
      reviewDecision: PullRequestFacts["reviewDecision"];
      headRefName: string;
      baseRefName: string;
      additions: number;
      deletions: number;
      changedFiles: number;
      createdAt: string;
      author: { login: string; __typename: string } | null;
      reviewRequests: { nodes: { requestedReviewer: { login?: string } | null }[] };
      reviews: { nodes: { author: { login: string } | null; state: string; submittedAt: string; commit: { oid: string } | null }[] };
      comments: { nodes: { createdAt: string }[] };
      files: { nodes: { path: string }[] };
      commits: {
        nodes: {
          commit: {
            oid: string;
            committedDate: string;
            statusCheckRollup: {
              state: string;
              contexts: { nodes: Record<string, unknown>[] };
            } | null;
          };
        }[];
      };
    };
  };
}

function mapChecks(contexts: Record<string, unknown>[]): CheckItem[] {
  return contexts.map((c) => {
    if (c.__typename === "CheckRun") {
      return { name: String(c.name), state: String(c.conclusion ?? c.status) };
    }
    return { name: String(c.context), state: String(c.state) };
  });
}

function mapDetail(owner: string, repo: string, data: DetailResponse): PullRequestFacts {
  const pr = data.repository.pullRequest;
  const commitNode = pr.commits.nodes[0]?.commit;
  const rollup = commitNode?.statusCheckRollup ?? null;

  const reviews: Review[] = pr.reviews.nodes
    .filter((r) => r.author != null)
    .map((r) => ({
      author: r.author!.login,
      state: r.state,
      submittedAt: r.submittedAt,
      commitSha: r.commit?.oid ?? "",
    }));

  const requestedReviewers = pr.reviewRequests.nodes
    .map((n) => n.requestedReviewer?.login)
    .filter((login): login is string => login != null);

  const lastReviewAt = reviews.length > 0
    ? reviews.reduce((latest, r) => (r.submittedAt > latest ? r.submittedAt : latest), reviews[0]!.submittedAt)
    : null;

  return {
    key: `${owner}/${repo}#${pr.number}`,
    owner,
    repo: `${owner}/${repo}`,
    repoName: repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author?.login ?? "ghost",
    authorIsBot: pr.author?.__typename === "Bot",
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    isDraft: pr.isDraft,
    mergeableState: pr.mergeable,
    reviewDecision: pr.reviewDecision,
    reviews,
    requestedReviewers,
    headCommitSha: commitNode?.oid ?? "",
    checkRollupState: (rollup?.state as PullRequestFacts["checkRollupState"]) ?? null,
    checks: rollup ? mapChecks(rollup.contexts.nodes) : [],
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    changedFilePaths: pr.files.nodes.map((f) => f.path),
    createdAt: pr.createdAt,
    lastCommitAt: commitNode?.committedDate ?? null,
    lastCommentAt: pr.comments.nodes[0]?.createdAt ?? null,
    lastReviewAt,
    body: pr.bodyText ?? "",
  };
}

/** A tiny fixed-concurrency pool — enough to keep a large PR queue from tripping rate limits. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/**
 * FR-1 + Data model: two searches (authored, review-requested), then one detail fetch per
 * unique PR at a small fixed concurrency. Grouping/derivation happens elsewhere — this
 * module only collects facts.
 */
export async function collectOpenPullRequests(): Promise<CollectResult> {
  const env = await resolveEnv();
  const viewerLogin = await resolveViewerLogin(env);

  const [authored, reviewRequested] = await Promise.all([
    searchOpenPRs(env, "is:pr is:open author:@me archived:false"),
    searchOpenPRs(env, "is:pr is:open review-requested:@me archived:false"),
  ]);

  const uniqueRefs = new Map<string, PRRef>();
  for (const ref of [...authored, ...reviewRequested]) {
    uniqueRefs.set(`${ref.owner}/${ref.repo}#${ref.number}`, ref);
  }

  const prs = await mapWithConcurrency(Array.from(uniqueRefs.values()), FETCH_CONCURRENCY, async (ref) => {
    const data = await ghGraphql<DetailResponse>(env, DETAIL_QUERY, {
      owner: ref.owner,
      repo: ref.repo,
      number: ref.number,
    });
    return mapDetail(ref.owner, ref.repo, data);
  });

  return { viewerLogin, prs };
}
