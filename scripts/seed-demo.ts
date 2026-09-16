/**
 * Inserts one example week of content so the dashboard and newsletter can be
 * viewed without an Anthropic API key. The text here is hand-written sample
 * data, not model output — use `npm run pipeline` for real content.
 *
 *   npx tsx scripts/seed-demo.ts
 */
import { prisma } from '../lib/db';
import { buildEmailHtml } from '../lib/email';
import { weekOf } from '../lib/week';

const week = weekOf();

const REPOS = [
  {
    fullName: 'demo-org/browser-pilot',
    owner: 'demo-org',
    name: 'browser-pilot',
    url: 'https://github.com/demo-org/browser-pilot',
    description: 'Drive a real browser with natural language instructions.',
    language: 'TypeScript',
    stars: 18400,
    starsGained: 3100,
    forks: 920,
    summary:
      'Browser Pilot exposes a headless Chrome session to a language model as a set of tools, so a plain-English instruction becomes a sequence of clicks, form fills, and assertions. It ships an MCP server so any compatible client can drive it.',
    whyItMatters:
      'Web automation has historically meant writing brittle selectors that break on the next redesign. Handing the page to a model that reads the accessibility tree instead shifts the failure mode from "the selector changed" to "the instruction was ambiguous" — a much more tractable problem, and the reason browser agents are suddenly everywhere.',
    technologies: ['TypeScript', 'Playwright', 'MCP', 'Node.js'],
    tags: ['Browser Automation', 'AI Agent', 'MCP'],
    learnTopics: [
      'Tool calling and the agent loop',
      'Model Context Protocol (MCP) server design',
      'Playwright and the accessibility tree',
      'Deterministic replay of non-deterministic runs',
    ],
    difficulty: 'Intermediate',
    learningPath:
      'Start with Playwright on its own — script a login and a form submission by hand so you know what the model is being asked to do. Then write a two-tool agent loop (click, read_page) against the accessibility tree rather than CSS selectors. Add MCP last; it is a thin transport over tools you already have, and it makes far more sense once you have felt the loop work.',
    cloneTitle: 'Form Filler',
    cloneDescription:
      'A CLI that takes a URL and a sentence describing what to do, then completes a single-page form in a real browser. No planning, no retries — one page, one pass.',
    cloneFeatures: [
      'Read the page accessibility tree into a compact text summary',
      'Two tools: fill_field and click_button',
      'Loop until the model reports done or hits a step cap',
      'Save a screenshot of the final state',
    ],
    cloneStack: ['TypeScript', 'Playwright', '@anthropic-ai/sdk'],
    cloneDifficulty: 'Beginner',
    cloneTimeEstimate: '4-6 hours',
    rank: 0,
  },
  {
    fullName: 'demo-org/context-lake',
    owner: 'demo-org',
    name: 'context-lake',
    url: 'https://github.com/demo-org/context-lake',
    description: 'Incremental retrieval index that updates as your documents change.',
    language: 'Python',
    stars: 9700,
    starsGained: 1850,
    forks: 410,
    summary:
      'Context Lake keeps a vector index in sync with a source of truth — a repo, a wiki, a bucket — by tracking content hashes and re-embedding only what changed. It exposes retrieval as a single query interface over multiple backends.',
    whyItMatters:
      'Most RAG tutorials build the index once and never mention what happens on day two. In production, staleness is the dominant failure: the index quietly drifts from reality and answers get confidently wrong. Treating the index as a materialized view that must be maintained, rather than a build artifact, is the unglamorous idea that separates a demo from a system.',
    technologies: ['Python', 'DuckDB', 'sentence-transformers', 'FastAPI'],
    tags: ['RAG', 'Infrastructure', 'DevTools'],
    learnTopics: [
      'Chunking strategies and their tradeoffs',
      'Content-hash based incremental indexing',
      'Vector similarity search and approximate nearest neighbours',
      'Evaluating retrieval quality with recall@k',
    ],
    difficulty: 'Advanced',
    learningPath:
      'Build the naive version first: chunk a directory of Markdown, embed it, and query it. Then deliberately break it — edit a file and watch the stale answer come back. That failure is the whole lesson. Add content hashing to fix it, and only then look at approximate search, which matters at a scale you will not reach on a laptop.',
    cloneTitle: 'Notes Recall',
    cloneDescription:
      'Point it at a folder of Markdown notes and ask questions about them. It re-embeds only files whose hash changed, so the second run is nearly instant.',
    cloneFeatures: [
      'Walk a directory and chunk Markdown by heading',
      'Store embeddings plus a content hash per chunk in SQLite',
      'Skip unchanged files on re-index',
      'Answer questions using the top-k retrieved chunks',
    ],
    cloneStack: ['Python', 'SQLite', 'sqlite-vec', 'Anthropic SDK'],
    cloneDifficulty: 'Intermediate',
    cloneTimeEstimate: '1 weekend',
    rank: 1,
  },
];

async function main() {
  console.log(`Seeding demo content for week of ${week}...`);

  const saved = [];
  for (const repo of REPOS) {
    const { technologies, tags, learnTopics, cloneFeatures, cloneStack, fullName, ...rest } = repo;
    const data = {
      ...rest,
      technologies: JSON.stringify(technologies),
      tags: JSON.stringify(tags),
      learnTopics: JSON.stringify(learnTopics),
      cloneFeatures: JSON.stringify(cloneFeatures),
      cloneStack: JSON.stringify(cloneStack),
    };
    saved.push(
      await prisma.repo.upsert({
        where: { fullName_weekOf: { fullName, weekOf: week } },
        create: { fullName, weekOf: week, ...data },
        update: data,
      }),
    );
    console.log(`  ${fullName}`);
  }

  const markdown = `Two projects this week point at the same shift: models are increasingly given a live
system to act on rather than a static blob of text to summarize. A browser agent
and an incrementally-maintained retrieval index look unrelated until you notice
both are really about keeping a model's view of the world current.

## Browser agents stopped being a demo

**browser-pilot** drives a real Chrome session from plain-English instructions. The
interesting choice is that it reads the accessibility tree instead of CSS
selectors — which is why it survives a redesign that would break a traditional
Playwright suite.

If you want to learn from it, the concept to chase is the agent loop itself:
a model, a small set of tools, and a termination condition. Everything else in
the repo is plumbing around that.

## Retrieval is a maintenance problem, not a build step

**context-lake** is a quieter project with a sharper lesson. Nearly every RAG
tutorial indexes a corpus once and stops. Real systems fail on day two, when the
documents change and the index does not. Treating the index as a materialized
view you have to keep fresh is the whole idea.

## Weekend Build

Build **Form Filler**: a CLI that takes a URL and one sentence, then completes a
single-page form in a real browser. Two tools, one page, no retries. It is small
enough to finish on a Saturday and it teaches the agent loop by making you feel
where it breaks — which no amount of reading about tool calling will do.`;

  const title = 'Browser agents and the day-two problem';
  const subtitle = 'Two projects, one idea: keeping a model’s view of the world current.';

  const payload = {
    title,
    subtitle,
    markdown,
    html: buildEmailHtml({ title, subtitle, markdown, weekOf: week }),
    featuredRepoId: saved[0].id,
  };

  await prisma.issue.upsert({
    where: { weekOf: week },
    create: { slug: week, weekOf: week, ...payload },
    update: payload,
  });

  console.log(`  Issue: "${title}"`);
  console.log('\nDone. Run `npm run dev` to view it.\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
