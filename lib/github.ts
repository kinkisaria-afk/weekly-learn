import { ProxyAgent } from 'undici';

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

const UA = 'weekly-learn/0.1 (+https://github.com/kinkisaria-afk/weekly-learn)';

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

// —— 可选代理支持 ——
// 国内网络直连 GitHub 不稳定。通过 HTTPS_PROXY 环境变量可让所有 GitHub API
// 请求走 HTTP 代理（Node 原生 fetch 不读取系统/环境代理，需要显式注入）。
// 不设置该变量时走直连，行为与原来完全一致。这里惰性读取是必要的：process.env
// 要等 Prisma 加载 .env 之后才有值，而模块求值顺序不定，所以放到首次请求时才读。
let _proxyAgent: ProxyAgent | undefined;
let _proxyResolved = false;

function proxyAgent(): ProxyAgent | undefined {
  if (!_proxyResolved) {
    _proxyResolved = true;
    const proxy = process.env.HTTPS_PROXY;
    if (proxy) {
      try {
        _proxyAgent = new ProxyAgent(proxy);
      } catch {
        // 代理地址非法时回退直连，避免拖垮整条 pipeline。
        _proxyAgent = undefined;
      }
    }
  }
  return _proxyAgent;
}

/** 统一的 fetch 封装：配置了 HTTPS_PROXY 时自动注入代理 dispatcher。 */
function ghFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const dispatcher = proxyAgent();
  if (!dispatcher) return fetch(input, init);
  return fetch(input, { ...init, dispatcher } as RequestInit & { dispatcher: ProxyAgent });
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

  const res = await ghFetch(url, { headers: ghHeaders() });
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
    ghFetch(`https://api.github.com/repos/${repo.fullName}`, { headers: ghHeaders() }).then((r) =>
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
  const res = await ghFetch(`https://api.github.com/repos/${fullName}/readme`, {
    headers: ghHeaders('application/vnd.github.raw'),
  });
  if (!res.ok) return null;
  const text = await res.text();
  // Trim to keep the analysis prompt within a sane token budget.
  return text.slice(0, 12000);
}
