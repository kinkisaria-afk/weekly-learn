export type TrendingRepo = {
  fullName: string;
  owner: string;
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  starsGained: number;
  forks: number;
  readme: string | null;
};

const UA = 'learn-from-github/0.1 (+https://github.com/viviannnl/learn-from-github)';

function ghHeaders(accept = 'application/vnd.github+json'): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept,
    'User-Agent': UA,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type TrendingEntry = Pick<
  TrendingRepo,
  'fullName' | 'owner' | 'name' | 'url' | 'description' | 'starsGained'
>;

/** The subset of a GitHub Search API result we consume. */
type SearchItem = {
  full_name: string;
  owner: { login: string };
  name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
};

type SearchResponse = { items: SearchItem[] };

/**
 * GitHub has no "trending" API, and the HTML page (github.com/trending) is
 * blocked from many networks — so instead we query the official Search API
 * (api.github.com) for repositories created in the last 7 days, ranked by
 * stars. That yields "this week's breakout new projects", which serves the
 * same purpose: repos a reader can learn from and clone while they're still
 * small enough to actually finish. `starsGained` is set to total stars because
 * a repo created within the week has gained essentially all of its stars this
 * week.
 */
export async function fetchTrending(limit = 25): Promise<TrendingEntry[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', `created:>${since}`);
  url.searchParams.set('sort', 'stars');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(limit));

  const res = await fetch(url.toString(), { headers: ghHeaders() });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      throw new Error(
        `GitHub Search API returned ${res.status} — unauthenticated search is limited (10 req/min). ` +
          'Set GITHUB_TOKEN in .env to raise it.',
      );
    }
    throw new Error(`GitHub Search API returned ${res.status}`);
  }

  const data = (await res.json()) as SearchResponse;

  return data.items.slice(0, limit).map((item) => ({
    fullName: item.full_name,
    owner: item.owner.login,
    name: item.name,
    url: item.html_url,
    description: item.description ?? null,
    starsGained: item.stargazers_count,
  }));
}

/** Repo metadata + README, used as the AI analysis input. */
export async function enrich(
  repo: Pick<TrendingRepo, 'fullName' | 'owner' | 'name' | 'url' | 'description' | 'starsGained'>,
): Promise<TrendingRepo> {
  const [meta, readme] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo.fullName}`, { headers: ghHeaders() }).then((r) =>
      r.ok ? r.json() : null,
    ),
    fetchReadme(repo.fullName),
  ]);

  return {
    ...repo,
    description: meta?.description ?? repo.description,
    language: meta?.language ?? null,
    stars: meta?.stargazers_count ?? 0,
    forks: meta?.forks_count ?? 0,
    readme,
  };
}

async function fetchReadme(fullName: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${fullName}/readme`, {
    headers: ghHeaders('application/vnd.github.raw'),
  });
  if (!res.ok) return null;
  const text = await res.text();
  // Trim to keep the analysis prompt within a sane token budget.
  return text.slice(0, 12000);
}
