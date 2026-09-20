const REPO = "shawnbure/elm-chat";
const TTL_MS = 15 * 60 * 1000;

type GithubIssue = {
  number?: number;
  title?: string;
  pull_request?: unknown;
  closed_at?: string | null;
  created_at?: string;
  state_reason?: string | null;
};

export type CommunityIssue = {
  number: number;
  title: string;
  url: string;
  date: string;
};

export type CommunityFeed = {
  fixes: CommunityIssue[];
  requests: CommunityIssue[];
};

function mapIssue(issue: GithubIssue, date: string | null | undefined): CommunityIssue | null {
  if (
    issue.pull_request ||
    !Number.isSafeInteger(issue.number) ||
    (issue.number ?? 0) < 1 ||
    typeof issue.title !== "string" ||
    !date ||
    !Number.isFinite(Date.parse(date))
  ) {
    return null;
  }
  return {
    number: issue.number!,
    title: issue.title.slice(0, 180),
    url: `https://github.com/${REPO}/issues/${issue.number}`,
    date
  };
}

export function shapeCommunityFeed(open: GithubIssue[], closed: GithubIssue[]): CommunityFeed {
  const fixes = closed
    .filter((issue) => issue.state_reason === "completed" || issue.state_reason == null)
    .map((issue) => mapIssue(issue, issue.closed_at))
    .filter((issue): issue is CommunityIssue => issue !== null)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 5);
  const requests = open
    .map((issue) => mapIssue(issue, issue.created_at))
    .filter((issue): issue is CommunityIssue => issue !== null)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 5);
  return { fixes, requests };
}

let cache: { at: number; feed: CommunityFeed } | null = null;
let pending: Promise<CommunityFeed> | null = null;

async function fetchIssues(state: "open" | "closed"): Promise<GithubIssue[]> {
  const url = new URL(`https://api.github.com/repos/${REPO}/issues`);
  url.searchParams.set("state", state);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "50");
  const response = await fetch(url, {
    headers: {
      "user-agent": "elm-chat",
      accept: "application/vnd.github+json"
    }
  });
  if (!response.ok) throw new Error(`GitHub issues unavailable: ${response.status}`);
  const issues: unknown = await response.json();
  if (!Array.isArray(issues)) throw new Error("Invalid GitHub issues response.");
  return issues as GithubIssue[];
}

export async function getCommunityFeed(): Promise<CommunityFeed> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.feed;
  pending ??= Promise.all([fetchIssues("open"), fetchIssues("closed")])
    .then(([open, closed]) => {
      const feed = shapeCommunityFeed(open, closed);
      cache = { at: Date.now(), feed };
      return feed;
    })
    .finally(() => { pending = null; });
  try {
    return await pending;
  } catch {
    if (cache) return cache.feed;
    throw new Error("Community feed unavailable.");
  }
}
